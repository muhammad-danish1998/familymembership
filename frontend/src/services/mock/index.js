import {
  calculateFundSummary,
  calculateMemberSummary,
  calculateYearView,
  validateDeathRelease,
  validatePaymentAmount,
} from '../../lib/money.js';
import { validatePaymentDate, formatDate } from '../../lib/dates.js';
import { generateWhatsAppLink, formatMoney } from '../../lib/format.js';
import { INITIAL_SEED } from './seed.js';

const STORAGE_KEY = 'ff_mock_v1';
const ARTIFICIAL_DELAY_MS = 150;

function delay(ms = ARTIFICIAL_DELAY_MS) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getStore() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SEED));
    return JSON.parse(JSON.stringify(INITIAL_SEED));
  }
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SEED));
    return JSON.parse(JSON.stringify(INITIAL_SEED));
  }
}

function saveStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function writeAudit(store, action, detail, actor = 'Admin') {
  const entry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    actor,
    action,
    detail,
    created_at: new Date().toISOString(),
  };
  store.auditLog.unshift(entry);
}

// -------------------------------------------------------------
// Auth Service (Admin)
// -------------------------------------------------------------
export const auth = {
  async signIn(email, password) {
    await delay();
    const store = getStore();
    if (email === store.adminAuth.email && password === store.adminAuth.password) {
      const session = {
        user: { id: 'admin-1', email: store.adminAuth.email, role: 'admin' },
        token: `mock-admin-token-${Date.now()}`,
      };
      sessionStorage.setItem('ff_admin_session', JSON.stringify(session));
      return session;
    }
    throw { code: 'NOT_AUTHORIZED', message: 'Invalid admin email or password.' };
  },

  async signOut() {
    await delay();
    sessionStorage.removeItem('ff_admin_session');
  },

  async getSession() {
    await delay();
    const raw = sessionStorage.getItem('ff_admin_session');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  async changePassword(currentPassword, nextPassword) {
    await delay();
    const store = getStore();
    if (store.adminAuth.password !== currentPassword) {
      throw { code: 'VALIDATION', message: 'Current password is incorrect.' };
    }
    if (!nextPassword || nextPassword.length < 8 || !/\d/.test(nextPassword) || !/[a-zA-Z]/.test(nextPassword)) {
      throw {
        code: 'VALIDATION',
        message: 'New password must be at least 8 characters long and contain both letters and numbers.',
      };
    }
    store.adminAuth.password = nextPassword;
    writeAudit(store, 'PASSWORD_CHANGED', 'Admin password updated successfully.');
    saveStore(store);
    return { success: true };
  },
};

// -------------------------------------------------------------
// Family Service (PIN Protected, Read Only)
// -------------------------------------------------------------
export const family = {
  async login(pin) {
    await delay();
    const store = getStore();
    const { familyAccess } = store;

    // Check lockout
    if (familyAccess.lockedUntil && new Date(familyAccess.lockedUntil) > new Date()) {
      const remainingSecs = Math.ceil((new Date(familyAccess.lockedUntil) - new Date()) / 1000);
      throw {
        code: 'LOCKED',
        message: `Too many wrong attempts. Locked for ${remainingSecs} seconds.`,
      };
    }

    if (pin !== familyAccess.pin) {
      familyAccess.failedAttempts = (familyAccess.failedAttempts || 0) + 1;
      if (familyAccess.failedAttempts >= 5) {
        familyAccess.lockedUntil = new Date(Date.now() + 30000).toISOString();
        familyAccess.failedAttempts = 0;
      }
      saveStore(store);
      throw { code: 'WRONG_PIN', message: 'Incorrect family access PIN.' };
    }

    // Success reset failed attempts
    familyAccess.failedAttempts = 0;
    familyAccess.lockedUntil = null;
    saveStore(store);

    const token = `mock-family-token-v${familyAccess.pinVersion}-${Date.now()}`;
    sessionStorage.setItem('ff_family_token', token);
    return { token, pinVersion: familyAccess.pinVersion };
  },

  async getSummary(_token) {
    await delay();
    const store = getStore();
    return calculateFundSummary(store.payments, store.deathCases, store.members, store.settings);
  },

  async listMembers(_token, { search = '', page = 1, pageSize = 25 } = {}) {
    await delay();
    const store = getStore();
    let result = store.members.map((m) => {
      const memberPayments = store.payments.filter((p) => p.member_id === m.id);
      const summary = calculateMemberSummary(m, memberPayments, {
        annualContribution: store.settings.annual_contribution,
      });
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

  async getMember(_token, id) {
    await delay();
    const store = getStore();
    const m = store.members.find((item) => item.id === id);
    if (!m) throw { code: 'VALIDATION', message: 'Member not found.' };

    const memberPayments = store.payments.filter((p) => p.member_id === id);
    const summary = calculateMemberSummary(m, memberPayments, {
      annualContribution: store.settings.annual_contribution,
    });
    const yearView = calculateYearView(m, memberPayments, {
      annualContribution: store.settings.annual_contribution,
    });

    // Strip sensitive fields (CNIC & Address) as per BR-31
    return {
      id: m.id,
      name: m.name,
      father_name: m.father_name,
      mobile: m.mobile,
      join_date: m.join_date,
      status: m.status,
      coverage: m.coverage || {},
      summary,
      yearView,
      payments: memberPayments.map((p) => {
        const exec = p.executive_id ? store.executives.find((e) => e.id === p.executive_id) : null;
        return {
          id: p.id,
          amount: p.amount,
          type: p.type,
          payment_date: p.payment_date,
          received_by: exec ? exec.name : 'Admin',
          note: p.note,
        };
      }),
    };
  },
};

// -------------------------------------------------------------
// Fund Admin Summary Service
// -------------------------------------------------------------
export const fund = {
  async getSummary() {
    await delay();
    const store = getStore();
    return calculateFundSummary(store.payments, store.deathCases, store.members, store.settings);
  },
};

// -------------------------------------------------------------
// Members Admin Service
// -------------------------------------------------------------
export const members = {
  async list({ search = '', status = 'all', page = 1, pageSize = 25 } = {}) {
    await delay();
    const store = getStore();
    let list = store.members;

    if (status !== 'all') {
      list = list.filter((m) => m.status === status);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.father_name.toLowerCase().includes(q) ||
          m.mobile.includes(q) ||
          (m.cnic && m.cnic.includes(q))
      );
    }

    const items = list.map((m) => {
      const memberPayments = store.payments.filter((p) => p.member_id === m.id);
      const summary = calculateMemberSummary(m, memberPayments, {
        annualContribution: store.settings.annual_contribution,
      });
      return { ...m, summary };
    });

    const total = items.length;
    const start = (page - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), total, page, pageSize };
  },

  async get(id) {
    await delay();
    const store = getStore();
    const m = store.members.find((item) => item.id === id);
    if (!m) throw { code: 'VALIDATION', message: 'Member not found.' };

    const memberPayments = store.payments.filter((p) => p.member_id === id);
    const summary = calculateMemberSummary(m, memberPayments, {
      annualContribution: store.settings.annual_contribution,
    });
    const yearView = calculateYearView(m, memberPayments, {
      annualContribution: store.settings.annual_contribution,
    });

    return {
      ...m,
      summary,
      yearView,
      payments: memberPayments.map((p) => {
        const exec = p.executive_id ? store.executives.find((e) => e.id === p.executive_id) : null;
        return {
          ...p,
          executive_name: exec ? exec.name : 'Admin Direct',
        };
      }),
    };
  },

  async searchActive(query = '') {
    await delay();
    const store = getStore();
    const q = query.toLowerCase().trim();
    return store.members
      .filter((m) => m.status === 'active')
      .filter((m) => !q || m.name.toLowerCase().includes(q) || m.mobile.includes(q))
      .slice(0, 10);
  },

  async findDuplicateMobile(mobile, exceptId = null) {
    await delay();
    const store = getStore();
    const cleaned = mobile ? mobile.replace(/\D/g, '') : '';
    if (!cleaned) return null;

    const match = store.members.find(
      (m) => m.id !== exceptId && m.mobile.replace(/\D/g, '') === cleaned
    );
    return match ? { id: match.id, name: match.name, mobile: match.mobile } : null;
  },

  async add(data, { confirmDuplicate = false } = {}) {
    await delay();
    const store = getStore();

    if (!data.name || !data.father_name || !data.mobile || !data.join_date) {
      throw { code: 'VALIDATION', message: 'Name, Father Name, Mobile, and Join Date are required.' };
    }

    const cleanMobile = data.mobile.replace(/\D/g, '');
    if (cleanMobile.length < 10 || cleanMobile.length > 13) {
      throw { code: 'VALIDATION', message: 'Mobile number must be between 10 and 13 digits.' };
    }

    const dup = await this.findDuplicateMobile(data.mobile);
    if (dup && !confirmDuplicate) {
      throw {
        code: 'DUPLICATE_MOBILE',
        message: `Mobile number is already registered to "${dup.name}".`,
        duplicate: dup,
      };
    }

    const newMember = {
      id: `mem-${Date.now()}`,
      name: data.name.trim(),
      father_name: data.father_name.trim(),
      mobile: data.mobile.trim(),
      cnic: data.cnic ? data.cnic.trim() : '',
      address: data.address ? data.address.trim() : '',
      join_date: data.join_date,
      opening_balance: Number(data.opening_balance || 0),
      status: 'active',
      continues_from: data.continues_from || null,
      continued_by: null,
      coverage: data.coverage || { sons: 0, daughters: 0, wife: 0, father: 0, mother: 0, brothers: 0, sisters: 0, other: 0 },
    };

    store.members.push(newMember);
    writeAudit(store, 'MEMBER_ADDED', `Added member "${newMember.name}" (${newMember.mobile}).`);
    saveStore(store);
    return newMember;
  },

  async edit(id, data, { confirmDuplicate = false } = {}) {
    await delay();
    const store = getStore();
    const m = store.members.find((item) => item.id === id);
    if (!m) throw { code: 'VALIDATION', message: 'Member not found.' };

    const dup = await this.findDuplicateMobile(data.mobile, id);
    if (dup && !confirmDuplicate) {
      throw {
        code: 'DUPLICATE_MOBILE',
        message: `Mobile number is already registered to "${dup.name}".`,
        duplicate: dup,
      };
    }

    m.name = data.name.trim();
    m.father_name = data.father_name.trim();
    m.mobile = data.mobile.trim();
    m.cnic = data.cnic ? data.cnic.trim() : '';
    m.address = data.address ? data.address.trim() : '';

    writeAudit(store, 'MEMBER_EDITED', `Updated details for member "${m.name}".`);
    saveStore(store);
    return m;
  },

  async update(id, data) {
    return this.edit(id, data);
  },

  async setStatus(id, newStatus) {
    await delay();
    const store = getStore();
    const m = store.members.find((item) => item.id === id);
    if (!m) throw { code: 'VALIDATION', message: 'Member not found.' };

    m.status = newStatus;
    writeAudit(store, 'MEMBER_STATUS_CHANGED', `Changed status of member "${m.name}" to ${newStatus}.`);
    saveStore(store);
    return m;
  },

  async remove(id) {
    await delay();
    const store = getStore();
    const index = store.members.findIndex((item) => item.id === id);
    if (index === -1) throw { code: 'VALIDATION', message: 'Member not found.' };

    const m = store.members[index];
    store.members.splice(index, 1);
    store.payments = store.payments.filter((p) => p.member_id !== id);
    store.deathCases = store.deathCases.filter((c) => c.member_id !== id);
    writeAudit(store, 'MEMBER_DELETED', `Permanently deleted member "${m.name}".`);
    saveStore(store);
    return { success: true };
  },

  async saveCoverage(id, counts) {
    await delay();
    const store = getStore();
    const m = store.members.find((item) => item.id === id);
    if (!m) throw { code: 'VALIDATION', message: 'Member not found.' };

    m.coverage = { ...m.coverage, ...counts };
    writeAudit(store, 'COVERAGE_UPDATED', `Updated dependent coverage for "${m.name}".`);
    saveStore(store);
    return m.coverage;
  },

  async continueFamily(oldMemberId, newMemberData, { duesChoice = 'carry' } = {}) {
    await delay();
    const store = getStore();
    const oldMember = store.members.find((m) => m.id === oldMemberId);
    if (!oldMember) throw { code: 'VALIDATION', message: 'Original member not found.' };
    if (oldMember.continued_by) {
      throw { code: 'VALIDATION', message: 'Family continuation has already been set up for this member.' };
    }

    const oldPayments = store.payments.filter((p) => p.member_id === oldMemberId);
    const oldSummary = calculateMemberSummary(oldMember, oldPayments, {
      annualContribution: store.settings.annual_contribution,
    });

    const openingBalanceForNew = duesChoice === 'carry' ? oldSummary.remaining : 0;

    const newMember = {
      id: `mem-${Date.now()}`,
      name: newMemberData.name.trim(),
      father_name: newMemberData.father_name.trim(),
      mobile: newMemberData.mobile.trim(),
      cnic: newMemberData.cnic ? newMemberData.cnic.trim() : '',
      address: newMemberData.address ? newMemberData.address.trim() : oldMember.address,
      join_date: newMemberData.join_date,
      opening_balance: openingBalanceForNew,
      status: 'active',
      continues_from: oldMember.id,
      continued_by: null,
      coverage: newMemberData.coverage || { sons: 0, daughters: 0, wife: 0, father: 0, mother: 0, brothers: 0, sisters: 0, other: 0 },
    };

    oldMember.continued_by = newMember.id;
    store.members.push(newMember);

    writeAudit(
      store,
      'FAMILY_CONTINUED',
      `Continued family of deceased "${oldMember.name}" with new member "${newMember.name}". Dues ${duesChoice === 'carry' ? `carried over (Rs. ${openingBalanceForNew})` : 'waived'}.`
    );

    saveStore(store);
    return newMember;
  },

  async listPending() {
    await delay();
    const store = getStore();
    return store.members
      .filter((m) => m.approval_status === 'pending')
      .map((m) => {
        const exec = store.executives.find((e) => e.id === m.submitted_by_executive_id);
        return {
          ...m,
          submitted_by_executive_name: exec ? exec.name : m.submitted_by_executive_name || 'Executive',
        };
      });
  },

  async approveSubmission(id) {
    await delay();
    const store = getStore();
    const m = store.members.find((item) => item.id === id);
    if (!m) throw { code: 'VALIDATION', message: 'Member not found.' };

    m.approval_status = 'approved';
    m.status = 'active';
    writeAudit(store, 'MEMBER_SUBMISSION_APPROVED', `Admin approved member registration for "${m.name}".`);
    saveStore(store);
    return m;
  },

  async rejectSubmission(id) {
    await delay();
    const store = getStore();
    const m = store.members.find((item) => item.id === id);
    if (!m) throw { code: 'VALIDATION', message: 'Member not found.' };

    m.approval_status = 'rejected';
    m.status = 'inactive';
    writeAudit(store, 'MEMBER_SUBMISSION_REJECTED', `Admin rejected member registration for "${m.name}".`);
    saveStore(store);
    return m;
  },
};

// -------------------------------------------------------------
// Payments Admin Service (Immutable - BR-8)
// -------------------------------------------------------------
export const payments = {
  async list({ page = 1, pageSize = 25 } = {}) {
    await delay();
    const store = getStore();

    // Map reversal statuses
    const list = store.payments.map((p) => {
      const member = store.members.find((m) => m.id === p.member_id);
      const exec = p.executive_id ? store.executives.find((e) => e.id === p.executive_id) : null;
      const reversalRow = store.payments.find((r) => r.type === 'reversal' && r.reverses === p.id);

      return {
        ...p,
        member_name: member ? member.name : 'Unknown',
        member_mobile: member ? member.mobile : '',
        received_by: exec ? exec.name : 'Admin Direct',
        is_reversed: !!reversalRow,
        reversal_id: reversalRow ? reversalRow.id : null,
      };
    });

    // Sort newest first
    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const total = list.length;
    const start = (page - 1) * pageSize;
    return { items: list.slice(start, start + pageSize), total, page, pageSize };
  },

  async add({ memberId, amount, date, executiveId = null, note = '' }) {
    await delay();
    const store = getStore();
    const member = store.members.find((m) => m.id === memberId);
    if (!member) throw { code: 'VALIDATION', message: 'Member not found.' };

    const memberPayments = store.payments.filter((p) => p.member_id === memberId);
    const summary = calculateMemberSummary(member, memberPayments, {
      annualContribution: store.settings.annual_contribution,
    });

    // Validate amount
    const amountVal = validatePaymentAmount(amount, summary.maxPaymentAllowed);
    if (!amountVal.valid) throw { code: amountVal.code, message: amountVal.message };

    // Validate date
    const dateVal = validatePaymentDate(date, member.join_date);
    if (!dateVal.valid) throw { code: dateVal.code, message: dateVal.message };

    const paymentRow = {
      id: `pay-${Date.now()}`,
      member_id: memberId,
      amount: Number(amount),
      type: 'payment',
      reverses: null,
      payment_date: date,
      executive_id: executiveId || null,
      note: note ? note.trim() : '',
      created_by: 'Admin',
      created_at: new Date().toISOString(),
    };

    store.payments.push(paymentRow);
    writeAudit(
      store,
      'PAYMENT_ADDED',
      `Recorded payment of Rs. ${amount} for member "${member.name}".`
    );
    saveStore(store);
    return paymentRow;
  },

  async reverse(paymentId, reason) {
    await delay();
    const store = getStore();
    const original = store.payments.find((p) => p.id === paymentId);
    if (!original) throw { code: 'VALIDATION', message: 'Original payment not found.' };

    if (original.type === 'reversal') {
      throw { code: 'VALIDATION', message: 'Cannot reverse a reversal transaction.' };
    }

    const existingReversal = store.payments.find(
      (p) => p.type === 'reversal' && p.reverses === paymentId
    );
    if (existingReversal) {
      throw { code: 'ALREADY_REVERSED', message: 'This payment has already been reversed.' };
    }

    if (!reason || reason.trim().length === 0) {
      throw { code: 'REASON_REQUIRED', message: 'A reason is required to reverse a payment.' };
    }

    const member = store.members.find((m) => m.id === original.member_id);

    const reversalRow = {
      id: `pay-${Date.now()}`,
      member_id: original.member_id,
      amount: -original.amount,
      type: 'reversal',
      reverses: original.id,
      payment_date: new Date().toISOString().split('T')[0],
      executive_id: original.executive_id,
      note: `Reversal Reason: ${reason.trim()}`,
      created_by: 'Admin',
      created_at: new Date().toISOString(),
    };

    store.payments.push(reversalRow);
    writeAudit(
      store,
      'PAYMENT_REVERSED',
      `Reversed payment #${original.id} of Rs. ${original.amount} for "${member ? member.name : 'Member'}". Reason: ${reason}`
    );
    saveStore(store);
    return reversalRow;
  },

  async receipt(paymentId) {
    await delay();
    const store = getStore();
    const p = store.payments.find((item) => item.id === paymentId);
    if (!p) throw { code: 'VALIDATION', message: 'Payment not found.' };

    const member = store.members.find((m) => m.id === p.member_id);
    const exec = p.executive_id ? store.executives.find((e) => e.id === p.executive_id) : null;
    const collectorName = exec ? exec.name : 'Admin Direct';

    const textEn = `Receipt: Family Fund Payment\nMember: ${member ? member.name : ''}\nAmount: ${formatMoney(p.amount)}\nDate: ${formatDate(p.payment_date)}\nReceived By: ${collectorName}\nTransaction ID: ${p.id}\nThank you!`;
    const textUr = `رسید: فیملی فنڈ ادائیگی\nرکن: ${member ? member.name : ''}\nرقم: ${formatMoney(p.amount)}\nتاریخ: ${formatDate(p.payment_date)}\nوصول کنندہ: ${collectorName}\nٹرانزیکشن آئی ڈی: ${p.id}\nشکریہ!`;

    const whatsappUrlEn = generateWhatsAppLink(member ? member.mobile : '', textEn);
    const whatsappUrlUr = generateWhatsAppLink(member ? member.mobile : '', textUr);

    return {
      payment: p,
      member,
      textEn,
      textUr,
      whatsappUrlEn,
      whatsappUrlUr,
    };
  },
};

// -------------------------------------------------------------
// Death Cases Service (BR-20 to BR-27)
// -------------------------------------------------------------
export const cases = {
  async list() {
    await delay();
    const store = getStore();
    return store.deathCases.map((c) => {
      const member = store.members.find((m) => m.id === c.member_id);
      return {
        ...c,
        member_name: member ? member.name : 'Unknown',
        member_mobile: member ? member.mobile : '',
      };
    });
  },

  async register(data) {
    await delay();
    const store = getStore();

    if (!data.member_id || !data.deceased_name || !data.relation || !data.death_date) {
      throw { code: 'VALIDATION', message: 'Member, Deceased Name, Relation, and Date of Death are required.' };
    }

    // BR-22: Reject duplicate case for same member + relation + deceased name
    const normDeceased = data.deceased_name.trim().toLowerCase();
    const normRelation = data.relation.trim().toLowerCase();
    const duplicate = store.deathCases.find(
      (c) =>
        c.member_id === data.member_id &&
        c.relation.toLowerCase() === normRelation &&
        c.deceased_name.toLowerCase() === normDeceased
    );

    if (duplicate) {
      throw {
        code: 'DUPLICATE_CASE',
        message: `A death support case (${duplicate.ref}) already exists for this deceased person.`,
      };
    }

    const ref = `DS-${String(store.deathCases.length + 1).padStart(3, '0')}`;

    const newCase = {
      id: `case-${Date.now()}`,
      ref,
      member_id: data.member_id,
      deceased_name: data.deceased_name.trim(),
      relation: data.relation,
      death_date: data.death_date,
      status: 'registered',
      amount: store.settings.death_support,
      verified_at: null,
      verified_by: null,
      paid_at: null,
      paid_by: null,
      deficit_reason: null,
      notes: data.notes ? data.notes.trim() : '',
    };

    store.deathCases.push(newCase);
    
    // BR-23: If relation is self, set member status to deceased immediately
    if (data.relation && data.relation.toLowerCase() === 'self') {
      const member = store.members.find((m) => m.id === data.member_id);
      if (member) {
        member.status = 'deceased';
        writeAudit(store, 'MEMBER_STATUS_CHANGED', `Member "${member.name}" status updated to deceased on self death registration.`);
      }
    }

    writeAudit(store, 'CASE_REGISTERED', `Registered death case ${ref} for deceased "${newCase.deceased_name}".`);
    saveStore(store);
    return newCase;
  },

  async verify(id) {
    await delay();
    const store = getStore();
    const c = store.deathCases.find((item) => item.id === id);
    if (!c) throw { code: 'VALIDATION', message: 'Case not found.' };

    c.status = 'verified';
    c.verified_at = new Date().toISOString();
    c.verified_by = 'Admin';

    writeAudit(store, 'CASE_VERIFIED', `Verified death case ${c.ref}.`);
    saveStore(store);
    return c;
  },

  async release(id, { reason = '' } = {}) {
    await delay();
    const store = getStore();
    const c = store.deathCases.find((item) => item.id === id);
    if (!c) throw { code: 'VALIDATION', message: 'Case not found.' };
    if (c.status === 'paid') {
      throw { code: 'VALIDATION', message: 'This payout has already been released.' };
    }

    // Check balance and deficit limits (BR-25 & BR-26)
    const fundSummary = calculateFundSummary(store.payments, store.deathCases, store.members, store.settings);
    const releaseVal = validateDeathRelease(fundSummary.balance, c.amount, reason, store.settings.max_deficit);

    if (!releaseVal.allowed) {
      throw { code: releaseVal.code, message: releaseVal.message };
    }

    c.status = 'paid';
    c.paid_at = new Date().toISOString();
    c.paid_by = 'Admin';
    c.deficit_reason = releaseVal.requiresReason ? reason.trim() : null;

    // BR-23: If relation is self, update member status to deceased
    if (c.relation && c.relation.toLowerCase() === 'self') {
      const member = store.members.find((m) => m.id === c.member_id);
      if (member) {
        member.status = 'deceased';
        writeAudit(store, 'MEMBER_STATUS_CHANGED', `Member "${member.name}" status updated to deceased automatically on payout release.`);
      }
    }

    writeAudit(
      store,
      'CASE_RELEASED',
      `Released death support payout of Rs. ${c.amount} for case ${c.ref}.${c.deficit_reason ? ` Deficit reason: ${c.deficit_reason}` : ''}`
    );

    saveStore(store);
    return c;
  },
};

// -------------------------------------------------------------
// Executives Admin Service
// -------------------------------------------------------------
export const executives = {
  async list() {
    await delay();
    const store = getStore();
    return store.executives.map((exec) => {
      const execPayments = store.payments.filter((p) => p.executive_id === exec.id);
      const totalCollected = execPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      return {
        ...exec,
        totalCollected,
      };
    });
  },

  async add(name) {
    await delay();
    const store = getStore();
    if (!name || name.trim().length === 0) {
      throw { code: 'VALIDATION', message: 'Executive name is required.' };
    }
    const newExec = {
      id: `exec-${Date.now()}`,
      name: name.trim(),
      active: true,
    };
    store.executives.push(newExec);
    writeAudit(store, 'EXECUTIVE_ADDED', `Added executive collector "${newExec.name}".`);
    saveStore(store);
    return newExec;
  },

  async setActive(id, active) {
    await delay();
    const store = getStore();
    const exec = store.executives.find((e) => e.id === id);
    if (!exec) throw { code: 'VALIDATION', message: 'Executive not found.' };

    exec.active = !!active;
    writeAudit(store, 'EXECUTIVE_STATUS', `Set executive "${exec.name}" active status to ${exec.active}.`);
    saveStore(store);
    return exec;
  },

  async remove(id) {
    await delay();
    const store = getStore();
    const idx = store.executives.findIndex((e) => e.id === id);
    if (idx === -1) throw { code: 'VALIDATION', message: 'Executive not found.' };
    const [removed] = store.executives.splice(idx, 1);
    writeAudit(store, 'EXECUTIVE_REMOVED', `Removed executive collector "${removed.name}".`);
    saveStore(store);
    return { success: true };
  },

  async setPin(id, pin) {
    await delay();
    const store = getStore();
    const exec = store.executives.find((e) => e.id === id);
    if (!exec) throw { code: 'VALIDATION', message: 'Executive not found.' };
    const cleanPin = String(pin).trim();
    if (!cleanPin || cleanPin.length < 4 || cleanPin.length > 8 || !/^\d+$/.test(cleanPin)) {
      throw { code: 'VALIDATION', message: 'PIN must be between 4 and 8 digits.' };
    }
    exec.pin = cleanPin;
    writeAudit(store, 'EXECUTIVE_PIN_SET', `Set PIN for executive "${exec.name}".`);
    saveStore(store);
    return { success: true };
  },

  async login(id, pin) {
    await delay();
    const store = getStore();
    const exec = store.executives.find((e) => e.id === id);
    if (!exec || !exec.active) throw { code: 'VALIDATION', message: 'Executive account not found or inactive.' };
    const cleanPin = String(pin).trim();
    if (exec.pin && String(exec.pin).trim() !== cleanPin) {
      throw { code: 'VALIDATION', message: 'Incorrect PIN.' };
    }
    const token = `exec-token-${exec.id}-${Date.now()}`;
    return { token, executive: exec };
  },

  async submitMember(execId, pin, memberData) {
    await delay();
    const store = getStore();
    const exec = store.executives.find((e) => e.id === execId);
    if (!exec || !exec.active) throw { code: 'VALIDATION', message: 'Executive account not found or inactive.' };
    const cleanPin = String(pin).trim();
    if (exec.pin && String(exec.pin).trim() !== cleanPin) {
      throw { code: 'VALIDATION', message: 'Incorrect PIN.' };
    }

    const newMember = {
      id: `mem-${Date.now()}`,
      name: memberData.name.trim(),
      father_name: memberData.father_name.trim(),
      mobile: memberData.mobile.trim(),
      cnic: memberData.cnic ? memberData.cnic.trim() : '',
      address: memberData.address ? memberData.address.trim() : '',
      join_date: memberData.join_date,
      opening_balance: Number(memberData.opening_balance || 0),
      status: 'inactive',
      submitted_by_executive_id: exec.id,
      submitted_by_executive_name: exec.name,
      approval_status: 'pending',
      coverage: { sons: 0, daughters: 0, wife: 0, father: 0, mother: 0, brothers: 0, sisters: 0, other: 0 },
    };

    store.members.push(newMember);
    writeAudit(store, 'MEMBER_SUBMITTED_PENDING', `Executive "${exec.name}" submitted new member "${newMember.name}" for Admin approval.`);
    saveStore(store);
    return newMember;
  },
};

// -------------------------------------------------------------
// Settings Admin Service
// -------------------------------------------------------------
export const settings = {
  async get() {
    await delay();
    const store = getStore();
    return {
      annual_contribution: store.settings.annual_contribution,
      death_support: store.settings.death_support,
      max_deficit: store.settings.max_deficit,
      family_pin_length: store.familyAccess.pin.length,
    };
  },

  async changeFamilyPin(newPin) {
    await delay();
    const store = getStore();
    if (!newPin || newPin.length < 6 || newPin.length > 8 || !/^\d+$/.test(newPin)) {
      throw { code: 'VALIDATION', message: 'Family PIN must be between 6 and 8 numeric digits.' };
    }

    store.familyAccess.pin = newPin;
    store.familyAccess.pinVersion = (store.familyAccess.pinVersion || 1) + 1;
    writeAudit(store, 'PIN_CHANGED', `Family access PIN updated (Version ${store.familyAccess.pinVersion}).`);
    saveStore(store);
    return { success: true, version: store.familyAccess.pinVersion };
  },

  async clearAllData() {
    await delay();
    const store = getStore();
    store.members = [];
    store.payments = [];
    store.deathCases = [];
    writeAudit(store, 'DATA_CLEARED', 'Cleared all fund data for actual data entry.');
    saveStore(store);
  },
};

// -------------------------------------------------------------
// Audit Log Admin Service
// -------------------------------------------------------------
export const audit = {
  async list({ page = 1, pageSize = 50 } = {}) {
    await delay();
    const store = getStore();
    const total = store.auditLog.length;
    const start = (page - 1) * pageSize;
    return { items: store.auditLog.slice(start, start + pageSize), total, page, pageSize };
  },
};

// -------------------------------------------------------------
// Exporter & Backup Service
// -------------------------------------------------------------
export const exporter = {
  async membersCsv() {
    await delay();
    const store = getStore();
    const headers = ['ID', 'Name', 'Father Name', 'Mobile', 'Join Date', 'Status', 'Total Due', 'Paid', 'Remaining'];
    const rows = store.members.map((m) => {
      const memberPayments = store.payments.filter((p) => p.member_id === m.id);
      const summary = calculateMemberSummary(m, memberPayments, {
        annualContribution: store.settings.annual_contribution,
      });
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

  async paymentsCsv() {
    await delay();
    const store = getStore();
    const headers = ['Transaction ID', 'Member ID', 'Amount', 'Type', 'Date', 'Note'];
    const rows = store.payments.map((p) => [
      p.id,
      p.member_id,
      p.amount,
      p.type,
      p.payment_date,
      `"${(p.note || '').replace(/"/g, '""')}"`,
    ].join(','));
    return [headers.join(','), ...rows].join('\n');
  },

  async backupJson() {
    await delay();
    const store = getStore();
    return JSON.stringify(store, null, 2);
  },

  async restore(jsonString) {
    await delay();
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.members || !parsed.payments || !parsed.settings) {
        throw new Error('Invalid JSON format.');
      }
      saveStore(parsed);
      return { success: true };
    } catch {
      throw { code: 'VALIDATION', message: 'Failed to restore backup: Invalid JSON backup file.' };
    }
  },
};
