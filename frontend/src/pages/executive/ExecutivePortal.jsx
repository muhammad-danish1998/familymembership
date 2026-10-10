import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { executives } from '../../services/index.js';
import { useI18n } from '../../hooks/useI18n.js';

export function ExecutivePortal() {
  const { id } = useParams();
  const { isRtl } = useI18n();

  const [pin, setPin] = useState('');
  const [session, setSession] = useState(null);
  const [loginError, setLoginError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Submission Form state
  const [formData, setFormData] = useState({
    name: '',
    father_name: '',
    mobile: '',
    cnic: '',
    address: '',
    join_date: new Date().toISOString().split('T')[0],
    opening_balance: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

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
      setLoginError(err.message || (isRtl ? 'غلط پن یا غیر فعال اکاؤنٹ' : 'Incorrect PIN or inactive executive account'));
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
        opening_balance: 0,
      });
    } catch (err) {
      setSubmitError(err.message || (isRtl ? 'اندراج میں ناکامی' : 'Failed to submit member'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!session) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-400">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457-.312-2.841-.873-4.084" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-100">
              {isRtl ? 'ایگزیکٹو پورٹل لاگ ان' : 'Executive Portal Access'}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {isRtl ? 'نئے اراکین کے اندراج کے لیے اپنا پن داخل کریں' : 'Enter your Executive PIN to register new members'}
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
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500/20 border border-emerald-500/30 rounded-xl flex items-center justify-center text-emerald-400 font-bold text-lg">
            {executiveName.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                {isRtl ? 'ایگزیکٹو کلیکٹر' : 'Executive Collector'}
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-100 mt-0.5">{executiveName}</h1>
          </div>
        </div>

        <button
          onClick={() => {
            setSession(null);
            setPin('');
          }}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition"
        >
          {isRtl ? 'لاگ آؤٹ' : 'Logout Portal'}
        </button>
      </div>

      {/* Main Form Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="mb-6 border-b border-slate-800 pb-4">
          <h2 className="text-lg font-bold text-slate-100">
            {isRtl ? 'نیا رکن شامل کریں (منظوری کی درخواست)' : 'Submit New Member Request'}
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            {isRtl
              ? 'یہاں شامل کی گئی معلومات ایڈمن منظوری کے لیے جائے گی۔ منظوری کے بعد فنڈ میں شامل ہوگی۔'
              : 'Submissions require Admin approval before being activated in the family fund.'}
          </p>
        </div>

        {submitSuccess && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 flex items-start gap-3">
            <svg className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
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

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                {isRtl ? 'ابتدائی سابقہ بقایا (Opening Dues)' : 'Opening Balance Dues (Rs.)'}
              </label>
              <input
                type="number"
                min="0"
                name="opening_balance"
                value={formData.opening_balance}
                onChange={handleFormChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-emerald-500 text-sm"
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
    </div>
  );
}
