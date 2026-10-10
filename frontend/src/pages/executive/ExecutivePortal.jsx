import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { executives } from '../../services/index.js';
import { useI18n } from '../../hooks/useI18n.js';
import { Dialog } from '../../components/common/Dialog.jsx';
import { Button } from '../../components/common/Button.jsx';
import { MoneyDisplay } from '../../components/common/MoneyDisplay.jsx';
import { DateDisplay } from '../../components/common/DateDisplay.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { formatMobile, formatMoney } from '../../lib/format.js';
import {
  User,
  PlusCircle,
  CreditCard,
  CheckCircle,
  AlertTriangle,
  ShieldCheck,
  Copy,
  ExternalLink,
  Search,
  RefreshCw,
  LogOut,
  Wallet,
  Users,
  Clock,
  History,
} from 'lucide-react';

export function ExecutivePortal() {
  const { id } = useParams();
  const { isRtl } = useI18n();

  // Authentication State
  const [pin, setPin] = useState('');
  const [session, setSession] = useState(null);
  const [loginError, setLoginError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Tab State ('members' or 'add')
  const [activeTab, setActiveTab] = useState('members');

  // Executive Members List State
  const [myMembers, setMyMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Payment Recording State
  const [paymentModalMember, setPaymentModalMember] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    note: '',
  });
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  // Receipt Modal State
  const [receiptModal, setReceiptModal] = useState({
    isOpen: false,
    receiptText: '',
    whatsappLink: '',
    memberName: '',
    amount: 0,
  });
  const [copiedReceipt, setCopiedReceipt] = useState(false);

  // Payment History Drawer State
  const [historyModalMember, setHistoryModalMember] = useState(null);

  // Submission Form State
  const [formData, setFormData] = useState({
    name: '',
    father_name: '',
    mobile: '',
    cnic: '',
    address: '',
    join_date: new Date().toISOString().split('T')[0],
    opening_balance: 2000,
    memberType: 'new',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  // Load Executive's Submitted Members
  const loadMyMembers = async () => {
    if (!session || !pin) return;
    setLoadingMembers(true);
    try {
      const list = await executives.getMyMembers(id, pin.trim());
      setMyMembers(list);
    } catch (err) {
      console.error('Failed to fetch executive members:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    if (session) {
      loadMyMembers();
    }
  }, [session]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!pin || pin.trim().length === 0) {
      setLoginError(isRtl ? 'پن کا اندراج کریں' : 'Please enter PIN');
      return;
    }

    setIsAuthenticating(true);
    setLoginError('');

    try {
      const res = await executives.login(id, pin.trim());
      setSession(res);
    } catch (err) {
      setLoginError(
        err.message || (isRtl ? 'غلط پن یا غیر فعال اکاؤنٹ' : 'Incorrect PIN or inactive executive account')
      );
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmitMember = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitSuccess('');

    if (!formData.name || !formData.father_name || !formData.mobile) {
      setSubmitError(isRtl ? 'نام، ولدیت اور موبائل نمبر لازمی ہیں' : 'Name, Father Name, and Mobile Number are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await executives.submitMember(id, pin.trim(), formData);
      setSubmitSuccess(
        isRtl
          ? `رکن "${formData.name}" کی درخواست ایڈمن منظوری کے لیے ارسال کر دی گئی ہے۔ ایڈمن کی منظوری کے بعد فنڈ کا حساب شروع ہوگا۔`
          : `Member "${formData.name}" submitted for Admin approval! Dues calculation will begin once approved by Admin.`
      );
      setFormData({
        name: '',
        father_name: '',
        mobile: '',
        cnic: '',
        address: '',
        join_date: new Date().toISOString().split('T')[0],
        opening_balance: 2000,
        memberType: 'new',
      });
      // Refresh member list and switch to My Members tab
      await loadMyMembers();
      setActiveTab('members');
    } catch (err) {
      setSubmitError(err.message || (isRtl ? 'اندراج میں ناکامی' : 'Failed to submit member'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenRecordPayment = (member) => {
    setPaymentModalMember(member);
    setPaymentForm({
      amount: '',
      date: new Date().toISOString().split('T')[0],
      note: '',
    });
    setPaymentError('');
  };

  const handleRecordPaymentSubmit = async (e) => {
    e.preventDefault();
    setPaymentError('');

    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) {
      setPaymentError(isRtl ? 'براہ کرم درست رقم درج کریں' : 'Please enter a valid payment amount > 0.');
      return;
    }

    setIsRecordingPayment(true);
    try {
      const res = await executives.addPayment(id, pin.trim(), {
        memberId: paymentModalMember.id,
        amount: paymentForm.amount,
        date: paymentForm.date,
        note: paymentForm.note,
      });

      const currentMemName = paymentModalMember.name;
      const currentAmt = paymentForm.amount;

      setPaymentModalMember(null);
      setReceiptModal({
        isOpen: true,
        receiptText: res.receiptText,
        whatsappLink: res.whatsappLink,
        memberName: currentMemName,
        amount: currentAmt,
      });

      await loadMyMembers();
    } catch (err) {
      setPaymentError(err.message || (isRtl ? 'ادائیگی کا اندراج نہ ہو سکا' : 'Failed to record payment'));
    } finally {
      setIsRecordingPayment(false);
    }
  };

  const handleCopyReceipt = () => {
    if (receiptModal.receiptText) {
      navigator.clipboard.writeText(receiptModal.receiptText);
      setCopiedReceipt(true);
      setTimeout(() => setCopiedReceipt(false), 2500);
    }
  };

  // Filtered members list for executive dashboard
  const filteredMembers = myMembers.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.father_name.toLowerCase().includes(q) ||
      m.mobile.includes(q)
    );
  });

  // Calculate totals collected by this executive
  const totalCollectedByExec = myMembers.reduce((acc, m) => {
    const execPays = (m.payments || []).reduce((pAcc, p) => pAcc + (p.amount || 0), 0);
    return acc + execPays;
  }, 0);

  const approvedCount = myMembers.filter((m) => m.approval_status === 'approved').length;
  const pendingCount = myMembers.filter((m) => m.approval_status === 'pending').length;

  // -------------------------------------------------------------
  // Render PIN Login Screen if not authenticated
  // -------------------------------------------------------------
  if (!session) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-400">
              <User className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-100">
              {isRtl ? 'ایگزیکٹو پورٹل لاگ ان' : 'Executive Portal Access'}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {isRtl ? 'اپنا پن درج کر کے پورٹل میں داخل ہوں' : 'Enter your Executive PIN to access your portal'}
            </p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm text-center">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                {isRtl ? 'ایگزیکٹو پن (PIN)' : 'Executive PIN'}
              </label>
              <input
                type="password"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-center text-2xl tracking-widest text-slate-100 focus:outline-none focus:border-emerald-500"
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition shadow-lg shadow-emerald-950/40 disabled:opacity-50"
            >
              {isAuthenticating
                ? (isRtl ? 'تصدیق ہو رہی ہے...' : 'Authenticating...')
                : (isRtl ? 'پورٹل میں داخل ہوں' : 'Enter Portal')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const executiveName = session.executive?.name || (isRtl ? 'ایگزیکٹو ممبر' : 'Executive Member');

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-emerald-400 font-bold text-xl shadow-inner">
            {executiveName.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                {isRtl ? 'ایگزیکٹو پورٹل' : 'Executive Collector Portal'}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-100 mt-1">{executiveName}</h1>
          </div>
        </div>

        <button
          onClick={() => {
            setSession(null);
            setPin('');
            setMyMembers([]);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition border border-slate-700"
        >
          <LogOut className="w-4 h-4" />
          {isRtl ? 'لاگ آؤٹ' : 'Sign Out'}
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-xs">
          <span className="text-xs font-semibold text-slate-400 block">{isRtl ? 'کل درج شدہ اراکین' : 'Submitted Members'}</span>
          <span className="text-2xl font-bold text-slate-100 mt-1 block">{myMembers.length}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-xs">
          <span className="text-xs font-semibold text-slate-400 block">{isRtl ? 'منظور شدہ اراکین' : 'Approved Members'}</span>
          <span className="text-2xl font-bold text-emerald-400 mt-1 block">{approvedCount}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-xs">
          <span className="text-xs font-semibold text-slate-400 block">{isRtl ? 'غیر منظور شدہ / زیر التواء' : 'Pending Approval'}</span>
          <span className="text-2xl font-bold text-rose-400 mt-1 block">{pendingCount}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-xs">
          <span className="text-xs font-semibold text-slate-400 block">{isRtl ? 'ایگزیکٹو کی کل وصولی' : 'Total Collection'}</span>
          <MoneyDisplay amount={totalCollectedByExec} className="text-2xl font-bold text-emerald-400 mt-1 block" />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-800 space-x-2 rtl:space-x-reverse">
        <button
          onClick={() => setActiveTab('members')}
          className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm rounded-t-xl transition ${
            activeTab === 'members'
              ? 'bg-slate-900 border-t-2 border-emerald-500 text-emerald-400'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{isRtl ? 'میرے درجات اراکین اور ادائیگیاں' : 'My Submitted Members'}</span>
          <span className="ml-1 bg-slate-800 text-xs px-2 py-0.5 rounded-full text-slate-300">
            {myMembers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('add')}
          className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm rounded-t-xl transition ${
            activeTab === 'add'
              ? 'bg-slate-900 border-t-2 border-emerald-500 text-emerald-400'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          <span>{isRtl ? 'نیا رکن شامل کریں' : 'Submit New Member'}</span>
        </button>
      </div>

      {/* TAB 1: My Submitted Members & Record Payment */}
      {activeTab === 'members' && (
        <div className="bg-slate-900 border border-slate-800 rounded-b-2xl rounded-tr-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-100">
                {isRtl ? 'آپ کے درج کردہ اراکین اور ان کی وصولیاں' : 'Members Registered By You'}
              </h2>
              <p className="text-slate-400 text-xs mt-1">
                {isRtl
                  ? 'آپ صرف اپنے درج کردہ اراکین کی ادائیگیاں درج کر سکتے ہیں۔'
                  : 'You can view and record payments for members submitted by your executive account.'}
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isRtl ? 'نام یا موبائل تلاش کریں...' : 'Search name or mobile...'}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              </div>

              <button
                onClick={loadMyMembers}
                title="Refresh list"
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
              >
                <RefreshCw className={`w-4 h-4 ${loadingMembers ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {loadingMembers ? (
            <div className="py-12 text-center text-slate-400">
              <LoadingSpinner text={isRtl ? 'اراکین کی فہرست لوڈ ہو رہی ہے...' : 'Loading submitted members...'} />
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="py-12 text-center bg-slate-950/60 rounded-xl border border-slate-800 p-8 space-y-3">
              <Users className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-slate-300">
                {isRtl ? 'کوئی رکن نہیں ملا' : 'No Submitted Members Found'}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {searchQuery
                  ? (isRtl ? 'آپ کی تلاش کے مطابق کوئی رکن نہیں ہے۔' : 'No member matches your search query.')
                  : (isRtl ? 'آپ نے ابھی تک کوئی نیا رکن شامل نہیں کیا۔ "نیا رکن شامل کریں" پر کلک کریں۔' : 'You have not submitted any members yet. Click "Submit New Member" to add one.')}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setActiveTab('add')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition shadow-md mt-2 inline-flex items-center gap-1.5"
                >
                  <PlusCircle className="w-4 h-4" />
                  {isRtl ? 'نیا رکن درج کریں' : 'Register First Member'}
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left rtl:text-right">
                <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">{isRtl ? 'رکن کا نام' : 'Member Name'}</th>
                    <th className="px-4 py-3">{isRtl ? 'والد کا نام' : 'Father Name'}</th>
                    <th className="px-4 py-3">{isRtl ? 'موبائل نمبر' : 'Mobile'}</th>
                    <th className="px-4 py-3">{isRtl ? 'منظوری کی حالت' : 'Approval Status'}</th>
                    <th className="px-4 py-3">{isRtl ? 'ادا شدہ رقم' : 'Total Paid'}</th>
                    <th className="px-4 py-3">{isRtl ? 'بقایا واجبات' : 'Remaining Dues'}</th>
                    <th className="px-4 py-3 text-right rtl:text-left">{isRtl ? 'کارروائی' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredMembers.map((m) => {
                    const isUnapproved = m.approval_status === 'pending' || m.approval_status === 'rejected';
                    const paidAmt = m.summary?.paid || 0;
                    const remAmt = m.summary?.remaining || 0;

                    return (
                      <tr
                        key={m.id}
                        className={`transition ${
                          isUnapproved ? 'bg-rose-500/5 hover:bg-rose-500/10' : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="px-4 py-3.5 font-bold text-slate-100">{m.name}</td>
                        <td className="px-4 py-3.5 text-slate-300">{m.father_name}</td>
                        <td className="px-4 py-3.5 font-mono text-slate-300">{formatMobile(m.mobile)}</td>

                        {/* Approval Status Badge */}
                        <td className="px-4 py-3.5">
                          {isUnapproved ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                              <AlertTriangle className="w-3 h-3 text-rose-400" />
                              {isRtl ? 'نا منظور شدہ (زیر التواء)' : 'Pending Approval'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              <ShieldCheck className="w-3 h-3 text-emerald-400" />
                              {isRtl ? 'ایڈمن سے منظور شدہ' : 'Approved'}
                            </span>
                          )}
                        </td>

                        {/* Paid Amount */}
                        <td className="px-4 py-3.5 font-semibold text-emerald-400">
                          <MoneyDisplay amount={paidAmt} />
                        </td>

                        {/* Remaining Dues */}
                        <td className="px-4 py-3.5 font-semibold text-slate-200">
                          <MoneyDisplay amount={remAmt} />
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-right rtl:text-left space-x-2 rtl:space-x-reverse">
                          <button
                            onClick={() => handleOpenRecordPayment(m)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition shadow-sm text-xs inline-flex items-center gap-1"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>{isRtl ? 'رقم جمع کریں' : 'Record Payment'}</span>
                          </button>

                          <button
                            onClick={() => setHistoryModalMember(m)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition text-xs inline-flex items-center gap-1"
                            title={isRtl ? 'ہسٹری دیکھیں' : 'View Payment History'}
                          >
                            <History className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Submit New Member Form */}
      {activeTab === 'add' && (
        <div className="bg-slate-900 border border-slate-800 rounded-b-2xl rounded-tl-2xl p-6 sm:p-8 shadow-xl">
          <div className="mb-6 border-b border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-slate-100">
              {isRtl ? 'نیا رکن شامل کریں (منظوری کی درخواست)' : 'Submit New Member Request'}
            </h2>
            <p className="text-slate-400 text-xs mt-1">
              {isRtl
                ? 'یہاں شامل کی گئی معلومات ایڈمن منظوری کے لیے جائے گی۔ منظوری کے بعد فنڈ میں شامل ہوگی۔'
                : 'Submissions require Admin approval before being activated in the family fund.'}
            </p>
          </div>

          {submitSuccess && (
            <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">{submitSuccess}</p>
              </div>
            </div>
          )}

          {submitError && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {submitError}
            </div>
          )}

          <form onSubmit={handleSubmitMember} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  {isRtl ? 'رکن کا نام *' : 'Member Full Name *'}
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  placeholder={isRtl ? 'مثلاً محمد علی' : 'e.g. Muhammad Ali'}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-emerald-500 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  {isRtl ? 'ولدیت / سرپرست کا نام *' : 'Father / Guardian Name *'}
                </label>
                <input
                  type="text"
                  name="father_name"
                  value={formData.father_name}
                  onChange={handleFormChange}
                  placeholder={isRtl ? 'مثلاً احمد خان' : 'e.g. Ahmed Khan'}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-emerald-500 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  {isRtl ? 'موبائل نمبر *' : 'Mobile Number *'}
                </label>
                <input
                  type="text"
                  name="mobile"
                  value={formData.mobile}
                  onChange={handleFormChange}
                  placeholder="03001234567"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-emerald-500 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  {isRtl ? 'تاریخ شمولیت *' : 'Join Date *'}
                </label>
                <input
                  type="date"
                  name="join_date"
                  value={formData.join_date}
                  onChange={handleFormChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-emerald-500 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  {isRtl ? 'شناختی کارڈ نمبر (اختیاری)' : 'CNIC (Optional)'}
                </label>
                <input
                  type="text"
                  name="cnic"
                  value={formData.cnic}
                  onChange={handleFormChange}
                  placeholder="35201-1234567-1"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-emerald-500 text-sm"
                />
              </div>
            </div>

            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  {isRtl ? 'رکنیت کی قسم اور اندراج فیس' : 'Member Category & Entry Fee'}
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, memberType: 'new', opening_balance: 2000 }))}
                  className={`p-3 rounded-xl border text-left rtl:text-right text-xs font-semibold transition ${
                    formData.memberType !== 'existing'
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/30'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <div className="font-bold text-slate-100 text-sm">✨ {isRtl ? 'نیا رکن' : 'New Member'}</div>
                  <div className="text-emerald-400 mt-0.5">{isRtl ? 'یکمشت اندراج فیس: 2,000 روپے' : 'One-Time Entry Fee: Rs. 2,000'}</div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, memberType: 'existing', opening_balance: 0 }))}
                  className={`p-3 rounded-xl border text-left rtl:text-right text-xs font-semibold transition ${
                    formData.memberType === 'existing'
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/30'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <div className="font-bold text-slate-100 text-sm">👤 {isRtl ? 'پرانا / سینیئر رکن' : 'Old / Existing Member'}</div>
                  <div className="text-slate-400 mt-0.5">{isRtl ? 'سابقہ واجبات' : 'Custom Carried Dues'}</div>
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  {formData.memberType === 'existing'
                    ? (isRtl ? 'سابقہ بقایا واجبات (Rs.)' : 'Carried Dues / Previous Balance (Rs.)')
                    : (isRtl ? 'یکمشت اندراج فیس (Rs. 2,000)' : 'One-Time Entry Fee (Rs.)')}
                </label>
                <input
                  type="number"
                  min="0"
                  name="opening_balance"
                  value={formData.opening_balance}
                  onChange={handleFormChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-emerald-500 text-sm font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                {isRtl ? 'پتہ (اختیاری)' : 'Address (Optional)'}
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleFormChange}
                placeholder={isRtl ? 'گاؤں / محلہ' : 'Village / Area'}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-emerald-500 text-sm"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition shadow-lg shadow-emerald-950/40 disabled:opacity-50 text-sm"
              >
                {isSubmitting
                  ? (isRtl ? 'ارسال ہو رہا ہے...' : 'Submitting...')
                  : (isRtl ? 'منظوری کے لیے ارسال کریں' : 'Submit for Admin Approval')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      <Dialog
        isOpen={!!paymentModalMember}
        onClose={() => setPaymentModalMember(null)}
        title={paymentModalMember ? `Record Payment — ${paymentModalMember.name}` : ''}
        maxWidth="max-w-md"
      >
        {paymentModalMember && (
          <form onSubmit={handleRecordPaymentSubmit} className="space-y-4 py-2">
            {/* Member Quick Summary */}
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">{isRtl ? 'والد کا نام:' : 'Father Name:'}</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{paymentModalMember.father_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{isRtl ? 'اب تک ادا شدہ:' : 'Paid So Far:'}</span>
                <MoneyDisplay amount={paymentModalMember.summary?.paid || 0} className="font-bold text-emerald-600" />
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{isRtl ? 'بقایا واجبات:' : 'Remaining Dues:'}</span>
                <MoneyDisplay amount={paymentModalMember.summary?.remaining || 0} className="font-bold text-slate-900 dark:text-slate-100" />
              </div>
            </div>

            {paymentError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-300 text-xs">
                {paymentError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                {isRtl ? 'ادائیگی کی رقم (Rs.) *' : 'Payment Amount (Rs.) *'}
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                placeholder="e.g. 3000"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-100 font-mono text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                {isRtl ? 'تاریخ ادائیگی *' : 'Payment Date *'}
              </label>
              <input
                type="date"
                value={paymentForm.date}
                onChange={(e) => setPaymentForm((prev) => ({ ...prev, date: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                {isRtl ? 'نوٹ / تفصیل (اختیاری)' : 'Note / Remarks (Optional)'}
              </label>
              <input
                type="text"
                value={paymentForm.note}
                onChange={(e) => setPaymentForm((prev) => ({ ...prev, note: e.target.value }))}
                placeholder={isRtl ? 'مثلاً فنڈ میٹنگ کے موقع پر وصولی' : 'e.g. Collected at monthly meeting'}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPaymentModalMember(null)}
              >
                {isRtl ? 'منسوخ کریں' : 'Cancel'}
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={isRecordingPayment}
              >
                {isRtl ? 'ادائیگی محفوظ کریں' : 'Save Payment & Receipt'}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* RECEIPT MODAL */}
      <Dialog
        isOpen={receiptModal.isOpen}
        onClose={() => setReceiptModal((prev) => ({ ...prev, isOpen: false }))}
        title={isRtl ? 'ادائیگی کی رسید' : 'Payment Receipt Generated'}
        maxWidth="max-w-md"
      >
        <div className="space-y-4 py-2">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-7 h-7" />
            </div>
            <h4 className="font-bold text-base text-slate-900 dark:text-slate-100">
              {isRtl ? 'ادائیگی کامیابی سے درج ہو گئی!' : 'Payment Recorded Successfully!'}
            </h4>
            <p className="text-xs text-slate-500">
              {isRtl
                ? `رکن "${receiptModal.memberName}" کی ${formatMoney(receiptModal.amount)} وصولی درج کر لی گئی ہے۔`
                : `Collected ${formatMoney(receiptModal.amount)} for member "${receiptModal.memberName}".`}
            </p>
          </div>

          <div className="relative">
            <textarea
              readOnly
              rows={7}
              value={receiptModal.receiptText}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none"
            />
            <button
              onClick={handleCopyReceipt}
              className="absolute top-2 right-2 rtl:left-2 rtl:right-auto px-2.5 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition"
            >
              <Copy className="w-3.5 h-3.5" />
              {copiedReceipt ? (isRtl ? 'کاپی ہو گیا!' : 'Copied!') : (isRtl ? 'کاپی کریں' : 'Copy Text')}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <a
              href={receiptModal.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition text-center flex items-center justify-center gap-2 shadow-sm"
            >
              <ExternalLink className="w-4 h-4" />
              {isRtl ? 'واٹس ایپ پر شئیر کریں' : 'Share on WhatsApp'}
            </a>

            <Button
              variant="outline"
              onClick={() => setReceiptModal((prev) => ({ ...prev, isOpen: false }))}
            >
              {isRtl ? 'بند کریں' : 'Done'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* PAYMENT HISTORY DRAWER MODAL */}
      <Dialog
        isOpen={!!historyModalMember}
        onClose={() => setHistoryModalMember(null)}
        title={historyModalMember ? `${historyModalMember.name} — Payment History` : ''}
        maxWidth="max-w-xl"
      >
        {historyModalMember && (
          <div className="space-y-4 py-2 text-xs">
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-slate-500 block">{isRtl ? 'رکن کا نام:' : 'Member:'}</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{historyModalMember.name}</span>
              </div>
              <div>
                <span className="text-slate-500 block">{isRtl ? 'کل ادا شدہ:' : 'Total Paid:'}</span>
                <MoneyDisplay amount={historyModalMember.summary?.paid || 0} className="font-bold text-emerald-600 text-sm" />
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              {!historyModalMember.payments || historyModalMember.payments.length === 0 ? (
                <div className="p-6 text-center text-slate-400">
                  {isRtl ? 'اس رکن کی کوئی ادائیگی کی ہسٹری نہیں ہے۔' : 'No payment records found for this member.'}
                </div>
              ) : (
                <table className="w-full text-left rtl:text-right">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="p-2.5">{isRtl ? 'تاریخ' : 'Date'}</th>
                      <th className="p-2.5">{isRtl ? 'رقم' : 'Amount'}</th>
                      <th className="p-2.5">{isRtl ? 'وصول کنندہ' : 'Received By'}</th>
                      <th className="p-2.5">{isRtl ? 'تفصیل' : 'Note'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {historyModalMember.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="p-2.5"><DateDisplay date={p.payment_date} /></td>
                        <td className="p-2.5 font-mono font-bold text-emerald-600">
                          <MoneyDisplay amount={p.amount} />
                        </td>
                        <td className="p-2.5 font-semibold text-slate-700 dark:text-slate-300">
                          {p.received_by || 'Executive'}
                        </td>
                        <td className="p-2.5 text-slate-500">{p.note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setHistoryModalMember(null)}>
                {isRtl ? 'بند کریں' : 'Close'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
