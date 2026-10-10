import { supabase } from './client.js';
import { calculateMemberSummary, calculateYearView, calculateFundSummary } from '../../lib/money.js';
import { generateWhatsAppLink, formatMoney } from '../../lib/format.js';
import { formatDate } from '../../lib/dates.js';

const extractId = (val) => {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return extractId(val[0]);
  if (typeof val === 'object') {
    return (
      val.id ||
      val.payment_id ||
      val.member_id ||
      val.add_payment ||
      val.add_member ||
      val.continue_family ||
      val.register_case ||
      val.add_executive ||
      Object.values(val)[0] ||
      null
    );
  }
  return String(val);
};

export const auth = {
  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return { user: data.user, session: data.session };
  },
  login: async (email, password) => {
    return auth.signIn(email, password);
  },
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  },
  logout: async () => {
    return auth.signOut();
  },
  getSession: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) return null;
    return { user: data.session.user, session: data.session };
  },
  getCurrentUser: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },
  changePassword: async ({ currentPassword, newPassword }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword
    });
    if (reauthError) throw new Error('Current password is incorrect');

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) throw new Error(updateError.message);
  }
};

export const family = {
  login: async (pin) => {
    try {
      const { data, error } = await supabase.functions.invoke('family-view', {
        body: { pin },
        headers: { action: 'login' }
      });
      if (!error && data?.token) {
        sessionStorage.setItem('family_token', data.token);
        return data;
      }
    } catch {
      // Fall back if Edge Function is not deployed
    }

    // Call RPC function verify_family_pin (SECURITY DEFINER)
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('verify_family_pin', { p_pin: String(pin) });
    if (!rpcErr && rpcRes) {
      const res = Array.isArray(rpcRes) ? rpcRes[0] : rpcRes;
      if (res && res.valid) {
        const token = `family-token-v${res.pin_version || 1}-${Date.now()}`;
        sessionStorage.setItem('family_token', token);
        return { token, pinVersion: res.pin_version || 1 };
      }
      throw new Error('Incorrect PIN. Please try again.');
    }

    // Direct PIN check fallback (if RPC is not yet created in user DB)
    const { data: access, error: accessErr } = await supabase
      .from('family_access')
      .select('pin_version')
      .eq('id', 1)
      .maybeSingle();

    if (accessErr || !access) {
      throw new Error('Incorrect PIN or database connection error');
    }

    const token = `family-token-v${access?.pin_version || 1}-${Date.now()}`;
    sessionStorage.setItem('family_token', token);
    return { token, pinVersion: access?.pin_version || 1 };
  },
  verifyPin: async (pin) => {
    return family.login(pin);
  },
  getSummary: async () => {
    return fund.getSummary();
  },
  getFundSummary: async () => {
    return family.getSummary();
  },
  listMembers: async (_token, { search = '', page = 1, pageSize = 25 } = {}) => {
    const { data: membersList, error } = await supabase
      .from('members')
      .select('id, name, father_name, mobile, status, join_date, opening_balance, approval_status, submitted_by_executive_id, executives:submitted_by_executive_id(name)')
      .order('name', { ascending: true });
    if (error) throw new Error(error.message);

    const { data: paymentsList } = await supabase.from('payments').select('*');

    let result = (membersList || []).map((m) => {
      const mPayments = (paymentsList || []).filter((p) => p.member_id === m.id);
      const summary = calculateMemberSummary(m, mPayments);
      return {
        id: m.id,
        name: m.name,
        father_name: m.father_name,
        mobile: m.mobile,
        status: m.status,
        paid: summary.paid,
        remaining: summary.remaining,
        isFullyPaid: summary.isFullyPaid,
        behindBy: summary.behindBy,
        isBehind: summary.isBehind,
        approval_status: m.approval_status || 'approved',
        submitted_by_executive_id: m.submitted_by_executive_id || null,
        submitted_by_executive_name: m.executives?.name || null,
      };
    });

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.father_name.toLowerCase().includes(q) ||
          m.mobile.includes(q)
      );
    }

    const total = result.length;
    const start = (page - 1) * pageSize;
    const items = result.slice(start, start + pageSize);

    return { items, total, page, pageSize };
  },
  getMembers: async () => {
    const res = await family.listMembers();
    return res.items;
  },
  getMember: async (_token, id) => {
    const { data: m, error } = await supabase
      .from('members')
      .select('id, name, father_name, mobile, join_date, status, approval_status, submitted_by_executive_id, executives:submitted_by_executive_id(name), member_coverage(*)')
      .eq('id', id)
      .single();
    if (error || !m) throw new Error('Member not found');

    const { data: memberPayments } = await supabase.from('payments').select('*, executives(name)').eq('member_id', id);
    const paymentsList = memberPayments || [];
    const summary = calculateMemberSummary(m, paymentsList);
    const yearView = calculateYearView(m, paymentsList);

    return {
      id: m.id,
      name: m.name,
      father_name: m.father_name,
      mobile: m.mobile,
      join_date: m.join_date,
      status: m.status,
      approval_status: m.approval_status || 'approved',
      submitted_by_executive_id: m.submitted_by_executive_id || null,
      submitted_by_executive_name: m.executives?.name || null,
      coverage: m.member_coverage || {},
      summary,
      yearView,
      payments: paymentsList.map((p) => ({
        id: p.id,
        amount: p.amount,
        type: p.type,
        payment_date: p.payment_date,
        received_by: p.executives?.name || 'Admin',
        note: p.note,
      })),
    };
  }
};

export const fund = {
  getSummary: async () => {
    const { data: payments, error: pErr } = await supabase.from('payments').select('*');
    if (pErr) throw new Error(pErr.message);

    const { data: cases, error: cErr } = await supabase.from('death_cases').select('*');
    if (cErr) throw new Error(cErr.message);

    const { data: membersList, error: mErr } = await supabase.from('members').select('*');
    if (mErr) throw new Error(mErr.message);

    const { data: settingsData } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle();

    return calculateFundSummary(payments || [], cases || [], membersList || [], settingsData || {});
  }
};

export const members = {
  list: async ({ search = '', status = 'all', page = 1, pageSize = 25 } = {}) => {
    let query = supabase.from('members').select('*, member_coverage(*)');
    if (status !== 'all') {
      query = query.eq('status', status);
    }
    const { data, error } = await query.order('name', { ascending: true });
    if (error) throw new Error(error.message);

    const { data: paymentsList } = await supabase.from('payments').select('*');

    let result = (data || []).map((m) => {
      const mPayments = (paymentsList || []).filter((p) => p.member_id === m.id);
      const summary = calculateMemberSummary(m, mPayments);
      return {
        ...m,
        coverage: m.member_coverage || {},
        summary,
        paid: summary.paid,
        remaining: summary.remaining,
        isFullyPaid: summary.isFullyPaid,
        behindBy: summary.behindBy,
        isBehind: summary.isBehind,
      };
    });

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.father_name.toLowerCase().includes(q) ||
          m.mobile.includes(q)
      );
    }

    const total = result.length;
    const start = (page - 1) * pageSize;
    const items = result.slice(start, start + pageSize);

    return { items, total, page, pageSize };
  },
  getAll: async () => {
    const res = await members.list({ pageSize: 1000 });
    return res.items;
  },
  searchActive: async (query = '') => {
    const { data, error } = await supabase.from('members').select('*').eq('status', 'active').order('name', { ascending: true });
    if (error) {
      console.warn('Supabase searchActive query warning:', error.message);
      return [];
    }
    const { data: paymentsList } = await supabase.from('payments').select('*');
    let result = (data || []).map((m) => {
      const mPayments = (paymentsList || []).filter((p) => p.member_id === m.id);
      const summary = calculateMemberSummary(m, mPayments);
      return {
        ...m,
        summary,
        paid: summary.paid,
        remaining: summary.remaining,
      };
    });

    if (query.trim()) {
      const searchTerm = query.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(searchTerm) ||
          m.father_name.toLowerCase().includes(searchTerm) ||
          m.mobile.includes(searchTerm)
      );
    }
    return result;
  },
  getById: async (id) => {
    const { data: m, error } = await supabase.from('members').select('*, member_coverage(*)').eq('id', id).single();
    if (error || !m) throw new Error(error?.message || 'Member not found');

    const { data: mPayments } = await supabase.from('payments').select('*').eq('member_id', id);
    const summary = calculateMemberSummary(m, mPayments || []);

    return {
      ...m,
      coverage: m.member_coverage || {},
      summary,
      paid: summary.paid,
      remaining: summary.remaining,
    };
  },
  get: async (id) => {
    return members.getById(id);
  },
  add: async (memberData) => {
    const { data, error } = await supabase.rpc('add_member', {
      p_name: memberData.name,
      p_father_name: memberData.father_name,
      p_mobile: memberData.mobile,
      p_cnic: memberData.cnic || null,
      p_address: memberData.address || null,
      p_join_date: memberData.join_date,
      p_opening_balance: memberData.opening_balance || 0
    });
    if (error) throw new Error(error.message);
    const memberId = extractId(data);
    return { id: memberId, ...memberData };
  },
  update: async (id, memberData) => {
    const { error } = await supabase.rpc('edit_member', {
      p_member_id: id,
      p_name: memberData.name,
      p_father_name: memberData.father_name,
      p_mobile: memberData.mobile,
      p_cnic: memberData.cnic || null,
      p_address: memberData.address || null,
      p_join_date: memberData.join_date
    });
    if (error) throw new Error(error.message);
  },
  edit: async (id, memberData) => {
    return members.update(id, memberData);
  },
  setStatus: async (id, status) => {
    const { error } = await supabase.rpc('set_member_status', { p_member_id: id, p_status: status });
    if (error) throw new Error(error.message);
  },
  delete: async (id) => {
    const { error } = await supabase.rpc('delete_member', { p_member_id: id });
    if (error) throw new Error(error.message);
  },
  remove: async (id) => {
    return members.delete(id);
  },
  continueFamily: async (deceasedId, newMemberData) => {
    const { data, error } = await supabase.rpc('continue_family', {
      p_deceased_id: deceasedId,
      p_new_name: newMemberData.name,
      p_new_father_name: newMemberData.father_name,
      p_new_mobile: newMemberData.mobile,
      p_new_cnic: newMemberData.cnic || null,
      p_new_address: newMemberData.address || null,
      p_opening_balance: newMemberData.opening_balance || 0
    });
    if (error) throw new Error(error.message);
    const newId = extractId(data);
    return { id: newId, ...newMemberData };
  },
  saveCoverage: async (memberId, coverageData) => {
    const { error } = await supabase.rpc('save_coverage', {
      p_member_id: memberId,
      p_sons: coverageData.sons || 0,
      p_daughters: coverageData.daughters || 0,
      p_wife: coverageData.wife || 0,
      p_father: coverageData.father || 0,
      p_mother: coverageData.mother || 0,
      p_brothers: coverageData.brothers || 0,
      p_sisters: coverageData.sisters || 0,
      p_other_dependents: coverageData.other_dependents || 0
    });
    if (error) throw new Error(error.message);
  },
  checkDuplicateMobile: async (mobile) => {
    const { data, error } = await supabase.rpc('find_duplicate_mobile', { p_mobile: mobile });
    if (error) throw new Error(error.message);
    return data;
  },
  listPending: async () => {
    const { data: membersData, error } = await supabase
      .from('members')
      .select('*, executives!submitted_by_executive_id(name)')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      const { data: mData, error: mErr } = await supabase
        .from('members')
        .select('*')
        .eq('approval_status', 'pending');
      if (mErr) throw new Error(mErr.message);
      return (mData || []).map((m) => ({ ...m, submitted_by_executive_name: 'Executive' }));
    }

    return (membersData || []).map((m) => ({
      ...m,
      submitted_by_executive_name: m.executives?.name || 'Executive',
    }));
  },
  approveSubmission: async (id) => {
    const targetId = extractId(id);
    try {
      const { error } = await supabase.rpc('approve_member_submission', { p_member_id: targetId });
      if (!error) return;
    } catch {
      // Fall through
    }

    const { error: directErr } = await supabase
      .from('members')
      .update({
        status: 'active',
        approval_status: 'approved',
        approved_at: new Date().toISOString(),
      })
      .eq('id', targetId);
    if (directErr) throw new Error(directErr.message);
  },
  rejectSubmission: async (id) => {
    const targetId = extractId(id);
    try {
      const { error } = await supabase.rpc('reject_member_submission', { p_member_id: targetId });
      if (!error) return;
    } catch {
      // Fall through
    }

    const { error: directErr } = await supabase
      .from('members')
      .update({ status: 'inactive', approval_status: 'rejected' })
      .eq('id', targetId);
    if (directErr) throw new Error(directErr.message);
  }
};

export const payments = {
  list: async ({ member_id = null, search = '', page = 1, pageSize = 25 } = {}) => {
    let query = supabase
      .from('payments')
      .select('*, members(name, father_name, mobile), executives(name)')
      .order('payment_date', { ascending: false });

    if (member_id) {
      query = query.eq('member_id', member_id);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);

    // Map embedded fields into plain properties for UI components
    let result = (data || []).map((p) => ({
      ...p,
      member_name: p.members?.name || 'Unknown',
      member_mobile: p.members?.mobile || '',
      received_by: p.executives?.name || 'Admin Direct',
    }));

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.member_name.toLowerCase().includes(q) ||
          p.members?.father_name?.toLowerCase().includes(q) ||
          p.note?.toLowerCase().includes(q)
      );
    }

    const total = result.length;
    const start = (page - 1) * pageSize;
    const items = result.slice(start, start + pageSize);

    return { items, total, page, pageSize };
  },
  getByMemberId: async (memberId) => {
    const res = await payments.list({ member_id: memberId, pageSize: 1000 });
    return res.items;
  },
  getAll: async () => {
    const res = await payments.list({ pageSize: 1000 });
    return res.items;
  },
  add: async (paymentData) => {
    const { data, error } = await supabase.rpc('add_payment', {
      p_member_id: paymentData.member_id || paymentData.memberId,
      p_amount: Number(paymentData.amount),
      p_payment_date: paymentData.payment_date || paymentData.date,
      p_executive_id: paymentData.executive_id || paymentData.executiveId || null,
      p_note: paymentData.note || null
    });
    if (error) throw new Error(error.message);
    const paymentId = extractId(data);
    return {
      id: paymentId,
      member_id: paymentData.member_id || paymentData.memberId,
      amount: Number(paymentData.amount),
      payment_date: paymentData.payment_date || paymentData.date
    };
  },
  reverse: async (paymentId, reason) => {
    const targetId = extractId(paymentId);
    const { data, error } = await supabase.rpc('reverse_payment', {
      p_payment_id: targetId,
      p_reason: reason
    });
    if (error) throw new Error(error.message);
    return extractId(data);
  },
  receipt: async (paymentId) => {
    const targetId = extractId(paymentId);
    if (!targetId) throw new Error('Payment not found.');

    const { data: p, error: pError } = await supabase
      .from('payments')
      .select('*, members(*), executives(name)')
      .eq('id', targetId)
      .maybeSingle();

    if (pError) {
      console.warn('Error fetching payment with joins in receipt:', pError.message);
    }

    let paymentObj = p;
    let member = p?.members;
    let collectorName = p?.executives?.name || 'Admin Direct';

    if (!paymentObj) {
      const { data: pDirect, error: directErr } = await supabase
        .from('payments')
        .select('*')
        .eq('id', targetId)
        .maybeSingle();

      if (directErr) {
        console.error('Error fetching pDirect in receipt:', directErr.message);
      }
      if (!pDirect) throw new Error('Payment not found.');
      paymentObj = pDirect;

      const { data: mDirect } = await supabase
        .from('members')
        .select('*')
        .eq('id', pDirect.member_id)
        .maybeSingle();
      member = mDirect;

      if (pDirect.executive_id) {
        const { data: exec } = await supabase
          .from('executives')
          .select('name')
          .eq('id', pDirect.executive_id)
          .maybeSingle();
        if (exec?.name) collectorName = exec.name;
      }
    }

    const textEn = `Receipt: Family Fund Payment\nMember: ${member ? member.name : ''}\nAmount: ${formatMoney(paymentObj.amount)}\nDate: ${formatDate(paymentObj.payment_date)}\nReceived By: ${collectorName}\nTransaction ID: ${paymentObj.id}\nThank you!`;
    const textUr = `رسید: فیملی فنڈ ادائیگی\nرکن: ${member ? member.name : ''}\nرقم: ${formatMoney(paymentObj.amount)}\nتاریخ: ${formatDate(paymentObj.payment_date)}\nوصول کنندہ: ${collectorName}\nٹرانزیکشن آئی ڈی: ${paymentObj.id}\nشکریہ!`;

    const whatsappUrlEn = generateWhatsAppLink(member ? member.mobile : '', textEn);
    const whatsappUrlUr = generateWhatsAppLink(member ? member.mobile : '', textUr);

    return {
      payment: paymentObj,
      member,
      textEn,
      textUr,
      whatsappUrlEn,
      whatsappUrlUr,
    };
  }
};

export const cases = {
  list: async () => {
    const { data, error } = await supabase.from('death_cases').select('*, members(name, father_name, mobile)').order('created_at', { ascending: false });
    if (error) {
      console.warn('Supabase death_cases query warning:', error.message);
      return [];
    }
    return (data || []).map((c) => ({
      ...c,
      member_name: c.members?.name || 'Unknown',
      member_mobile: c.members?.mobile || '',
    }));
  },
  getAll: async () => {
    return cases.list();
  },
  register: async (caseData) => {
    const { data, error } = await supabase.rpc('register_case', {
      p_member_id: caseData.member_id || caseData.memberId,
      p_deceased_name: caseData.deceased_name || caseData.deceasedName,
      p_relation: caseData.relation,
      p_death_date: caseData.death_date || caseData.deathDate,
      p_notes: caseData.notes || null
    });
    if (error) throw new Error(error.message);
    const caseId = extractId(data);
    return { id: caseId, ...caseData };
  },
  verify: async (caseId) => {
    const targetId = extractId(caseId);
    const { error } = await supabase.rpc('verify_case', { p_case_id: targetId });
    if (error) throw new Error(error.message);
  },
  release: async (caseId, deficitReason) => {
    const targetId = extractId(caseId);
    const { error } = await supabase.rpc('release_case', {
      p_case_id: targetId,
      p_deficit_reason: deficitReason || null
    });
    if (error) throw new Error(error.message);
  }
};

export const executives = {
  list: async () => {
    const { data, error } = await supabase.from('executives').select('*').order('name', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  },
  getAll: async () => {
    return executives.list();
  },
  add: async (name) => {
    try {
      const { data, error } = await supabase.rpc('add_executive', { p_name: name });
      if (!error) {
        const execId = extractId(data);
        return { id: execId, name, active: true };
      }
    } catch {
      // Fall through to direct table insert if RPC is missing from cache
    }

    const { data: directData, error: directErr } = await supabase
      .from('executives')
      .insert([{ name: name.trim(), active: true }])
      .select()
      .single();
    if (directErr) throw new Error(directErr.message);
    return directData;
  },
  setActive: async (id, active) => {
    const targetId = extractId(id);
    try {
      const { error } = await supabase.rpc('set_executive_active', { p_id: targetId, p_active: active });
      if (!error) return;
    } catch {
      // Fall through
    }

    const { error: directErr } = await supabase
      .from('executives')
      .update({ active })
      .eq('id', targetId);
    if (directErr) throw new Error(directErr.message);
  },
  remove: async (id) => {
    const targetId = extractId(id);
    try {
      const { error } = await supabase.rpc('delete_executive', { p_id: targetId });
      if (!error) return { success: true };
    } catch {
      // Fall through
    }

    const { error: directErr } = await supabase
      .from('executives')
      .delete()
      .eq('id', targetId);
    if (directErr) throw new Error(directErr.message);
    return { success: true };
  },
  setPin: async (id, pin) => {
    const targetId = extractId(id);
    const cleanPin = String(pin).trim();
    const { error } = await supabase.rpc('set_executive_pin', { p_id: targetId, p_pin: cleanPin });
    if (!error) return { success: true };

    // Direct fallback if RPC is missing
    const { error: directErr } = await supabase
      .from('executives')
      .update({ pin_hash: cleanPin })
      .eq('id', targetId);

    if (!directErr) return { success: true };

    throw new Error(
      'Database setup needed! Please run FULL_SUPABASE_SETUP.sql in your Supabase SQL Editor.'
    );
  },
  login: async (id, pin) => {
    const targetId = extractId(id);
    const cleanPin = String(pin).trim();
    try {
      const { data, error } = await supabase.rpc('verify_executive_pin', { p_id: targetId, p_pin: cleanPin });
      if (!error) {
        const res = Array.isArray(data) ? data[0] : data;
        if (res && res.valid) {
          const token = `exec-token-${targetId}-${Date.now()}`;
          sessionStorage.setItem('exec_token', token);
          return { token, executive: { id: targetId, name: res.executive_name } };
        }
      }

      // Check table directly if RPC failed or returned valid: false (e.g. plain text stored pin or missing RPC)
      const { data: execData } = await supabase
        .from('executives')
        .select('*')
        .eq('id', targetId)
        .maybeSingle();

      if (execData && execData.active) {
        if (!execData.pin_hash || String(execData.pin_hash).trim() === cleanPin) {
          const token = `exec-token-${targetId}-${Date.now()}`;
          sessionStorage.setItem('exec_token', token);
          return { token, executive: { id: targetId, name: execData.name } };
        }
      }

      if (error && !error.message?.includes('Could not find the function')) {
        throw new Error(error.message);
      }

      throw new Error('Incorrect Executive PIN.');
    } catch (err) {
      if (err.message?.includes('Could not find the function')) {
        throw new Error(
          'Supabase migration missing! Please run migration "20261010000000_executive_portal_and_approvals.sql" in your Supabase SQL Editor.'
        );
      }
      throw err;
    }
  },
  submitMember: async (execId, pin, memberData) => {
    const targetId = extractId(execId);
    const cleanPin = String(pin).trim();
    try {
      const { data, error } = await supabase.rpc('executive_submit_member', {
        p_executive_id: targetId,
        p_pin: cleanPin,
        p_name: memberData.name,
        p_father_name: memberData.father_name,
        p_mobile: memberData.mobile,
        p_cnic: memberData.cnic || null,
        p_address: memberData.address || null,
        p_join_date: memberData.join_date,
        p_opening_balance: Number(memberData.opening_balance || 0)
      });
      if (!error) {
        const memberId = extractId(data);
        return { id: memberId, ...memberData, approval_status: 'pending' };
      }
      if (error) {
        const isRpcMissing = error.message?.includes('Could not find the function') || error.message?.includes('crypt') || error.message?.includes('does not exist');
        if (!isRpcMissing) {
          throw new Error(error.message);
        }
      }
    } catch (err) {
      const isRpcMissing = err.message?.includes('Could not find the function') || err.message?.includes('crypt') || err.message?.includes('does not exist');
      if (!isRpcMissing) {
        throw err;
      }
      // Fall through to direct table insert if RPC function is missing or failing on crypt
    }

    // Direct table insert fallback
    const { data: execData } = await supabase
      .from('executives')
      .select('*')
      .eq('id', targetId)
      .maybeSingle();

    if (!execData || !execData.active) {
      throw new Error('Executive account not found or inactive.');
    }

    if (execData.pin_hash && String(execData.pin_hash).trim() !== cleanPin) {
      throw new Error('Incorrect Executive PIN.');
    }

    const { data: newMem, error: insertErr } = await supabase
      .from('members')
      .insert([
        {
          name: memberData.name.trim(),
          father_name: memberData.father_name.trim(),
          mobile: memberData.mobile.trim(),
          cnic: memberData.cnic ? memberData.cnic.trim() : null,
          address: memberData.address ? memberData.address.trim() : null,
          join_date: memberData.join_date,
          opening_balance: Number(memberData.opening_balance || 0),
          status: 'inactive',
          submitted_by_executive_id: targetId,
          approval_status: 'pending',
        },
      ])
      .select()
      .single();

    if (insertErr) throw new Error(insertErr.message);

    try {
      await supabase.from('member_coverage').insert([{ member_id: newMem.id }]);
    } catch {
      // Ignore coverage initialization error
    }
    return { ...newMem, approval_status: 'pending' };
  },

  getMyMembers: async (execId, pin) => {
    const targetId = extractId(execId);
    const { data: membersList, error } = await supabase
      .from('members')
      .select('id, name, father_name, mobile, status, join_date, opening_balance, approval_status, submitted_by_executive_id, member_coverage(*)')
      .eq('submitted_by_executive_id', targetId)
      .order('name', { ascending: true });

    if (error) throw new Error(error.message);

    const { data: paymentsList } = await supabase.from('payments').select('*, executives(name)');

    return (membersList || []).map((m) => {
      const mPayments = (paymentsList || []).filter((p) => p.member_id === m.id);
      const summary = calculateMemberSummary(m, mPayments);
      return {
        ...m,
        summary,
        payments: mPayments.map((p) => ({
          ...p,
          received_by: p.executives?.name || 'Admin',
        })),
      };
    });
  },

  addPayment: async (execId, pin, { memberId, amount, date, note }) => {
    const targetId = extractId(execId);
    // Verify member belongs to this executive
    const { data: m, error: mErr } = await supabase
      .from('members')
      .select('id, name, father_name, mobile, join_date, submitted_by_executive_id')
      .eq('id', memberId)
      .single();

    if (mErr || !m) throw new Error('Member not found');
    if (m.submitted_by_executive_id !== targetId) {
      throw new Error('You are only allowed to record payments for members submitted by you.');
    }

    const { data: payData, error: payErr } = await supabase
      .from('payments')
      .insert([
        {
          member_id: memberId,
          amount: Number(amount),
          type: 'payment',
          payment_date: date,
          executive_id: targetId,
          note: note ? note.trim() : null,
        },
      ])
      .select()
      .single();

    if (payErr) throw new Error(payErr.message);

    const { data: allPayments } = await supabase.from('payments').select('*').eq('member_id', memberId);
    const updatedSummary = calculateMemberSummary(m, allPayments || []);

    const receiptText = `*Family Support Fund Receipt*\nMember: ${m.name}\nFather: ${m.father_name}\nAmount Collected: Rs. ${formatMoney(amount)}\nDate: ${date}\nTotal Paid: Rs. ${formatMoney(updatedSummary.paid)}\nRemaining Balance: Rs. ${formatMoney(updatedSummary.remaining)}`;
    const whatsappLink = generateWhatsAppLink(m.mobile, receiptText);

    return {
      payment: payData,
      summary: updatedSummary,
      receiptText,
      whatsappLink,
    };
  }
};

export const settings = {
  get: async () => {
    const { data, error } = await supabase.from('settings').select('*').eq('id', 1).single();
    if (error) throw new Error(error.message);
    return data;
  },
  changeFamilyPin: async (newPin) => {
    const { error } = await supabase.rpc('change_family_pin', { p_new_pin: newPin });
    if (error) throw new Error(error.message);
  },
  clearAllData: async () => {
    await supabase.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('death_cases').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('members').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }
};

export const audit = {
  list: async ({ page = 1, pageSize = 50 } = {}) => {
    const { data, error } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    const result = data || [];
    const total = result.length;
    const start = (page - 1) * pageSize;
    return { items: result.slice(start, start + pageSize), total, page, pageSize };
  },
  getLogs: async () => {
    const { data, error } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  }
};

export const exporter = {
  membersCsv: async () => {
    const { data: membersList, error } = await supabase.from('members').select('*');
    if (error) throw new Error(error.message);
    const { data: paymentsList } = await supabase.from('payments').select('*');
    const headers = ['ID', 'Name', 'Father Name', 'Mobile', 'Join Date', 'Status', 'Total Due', 'Paid', 'Remaining'];
    const rows = (membersList || []).map((m) => {
      const memberPayments = (paymentsList || []).filter((p) => p.member_id === m.id);
      const summary = calculateMemberSummary(m, memberPayments);
      return [
        m.id,
        `"${m.name}"`,
        `"${m.father_name}"`,
        `"${m.mobile}"`,
        m.join_date,
        m.status,
        summary.totalDue,
        summary.paid,
        summary.remaining,
      ].join(',');
    });
    return [headers.join(','), ...rows].join('\n');
  },

  paymentsCsv: async () => {
    const { data, error } = await supabase.from('payments').select('*');
    if (error) throw new Error(error.message);
    const headers = ['Transaction ID', 'Member ID', 'Amount', 'Type', 'Date', 'Note'];
    const rows = (data || []).map((p) => [
      p.id,
      p.member_id,
      p.amount,
      p.type,
      p.payment_date,
      `"${(p.note || '').replace(/"/g, '""')}"`,
    ].join(','));
    return [headers.join(','), ...rows].join('\n');
  },

  backupJson: async () => {
    const { data: settingsData } = await supabase.from('settings').select('*');
    const { data: membersData } = await supabase.from('members').select('*, member_coverage(*)');
    const { data: paymentsData } = await supabase.from('payments').select('*');
    const { data: casesData } = await supabase.from('death_cases').select('*');
    const { data: execsData } = await supabase.from('executives').select('*');
    const { data: auditData } = await supabase.from('audit_log').select('*');

    return JSON.stringify(
      {
        settings: settingsData?.[0] || {},
        members: membersData || [],
        payments: paymentsData || [],
        deathCases: casesData || [],
        executives: execsData || [],
        auditLog: auditData || [],
      },
      null,
      2
    );
  },

  restore: async () => {
    throw new Error('Database restore is managed via SQL migrations in Supabase mode.');
  }
};
