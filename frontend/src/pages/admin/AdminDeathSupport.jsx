import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useI18n } from '../../hooks/useI18n.js';
import { useToast } from '../../hooks/useToast.js';
import { cases as casesService, members as membersService } from '../../services/index.js';
import { MoneyDisplay } from '../../components/common/MoneyDisplay.jsx';
import { DateDisplay } from '../../components/common/DateDisplay.jsx';
import { Button } from '../../components/common/Button.jsx';
import { Dialog } from '../../components/common/Dialog.jsx';
import { MemberPicker } from '../../components/common/MemberPicker.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { RELATIONS } from '../../constants/index.js';
import { UserX, CheckCircle, HeartHandshake, AlertCircle } from 'lucide-react';

export function AdminDeathSupport() {
  const { t } = useI18n();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dialog States
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [releaseCase, setReleaseCase] = useState(null);
  const [releaseMemberInfo, setReleaseMemberInfo] = useState(null);
  const [deficitReason, setDeficitReason] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    member_id: '',
    deceased_name: '',
    relation: 'self',
    death_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setShowRegisterDialog(true);
      searchParams.delete('action');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  const fetchCases = async () => {
    setLoading(true);
    try {
      const res = await casesService.list();
      setItems(Array.isArray(res) ? res : res?.items || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load death support cases.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!formData.member_id) {
      toast.error('Please select a member.');
      return;
    }
    setSubmitting(true);
    try {
      await casesService.register(formData);
      toast.success('Death support case registered.');
      setShowRegisterDialog(false);
      resetForm();
      fetchCases();
    } catch (err) {
      toast.error(err.message || 'Failed to register case.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (id) => {
    try {
      await casesService.verify(id);
      toast.success('Case verified.');
      fetchCases();
    } catch (err) {
      toast.error(err.message || 'Failed to verify case.');
    }
  };

  const openReleaseModal = async (c) => {
    setReleaseCase(c);
    setDeficitReason('');
    try {
      const mem = await membersService.get(c.member_id);
      setReleaseMemberInfo(mem);
    } catch {
      setReleaseMemberInfo(null);
    }
  };

  const handleReleaseSubmit = async (e) => {
    e.preventDefault();
    if (!releaseCase) return;
    setSubmitting(true);
    try {
      await casesService.release(releaseCase.id, { reason: deficitReason });
      toast.success('Death support payout released!');
      setReleaseCase(null);
      fetchCases();
    } catch (err) {
      toast.error(err.message || 'Failed to release payout.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      member_id: '',
      deceased_name: '',
      relation: 'self',
      death_date: new Date().toISOString().split('T')[0],
      notes: '',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('navDeathSupport')}</h1>
          <p className="text-xs text-slate-500">Register, verify & release Rs. 70,000 family death support benefits</p>
        </div>
        <Button variant="primary" onClick={() => { resetForm(); setShowRegisterDialog(true); }}>
          <UserX className="w-4 h-4" />
          {t('registerDeathCase')}
        </Button>
      </div>

      {/* Case List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <LoadingSpinner text="Loading death cases..." />
        ) : items.length === 0 ? (
          <EmptyState title="No death cases registered" description="Click 'Register Death Case' to submit a new family support case." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left rtl:text-right">
              <thead className="bg-slate-50 dark:bg-slate-800 text-xs text-slate-500 uppercase font-semibold border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3">Case Ref</th>
                  <th className="px-6 py-3">Deceased Person</th>
                  <th className="px-6 py-3">Member & Relation</th>
                  <th className="px-6 py-3">Date of Death</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">{t('status')}</th>
                  <th className="px-6 py-3 text-right rtl:text-left">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-mono font-semibold text-xs text-slate-600 dark:text-slate-400">{c.ref}</td>
                    <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{c.deceased_name}</td>
                    <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400">
                      <div>{c.member_name}</div>
                      <div className="capitalize text-slate-400">Relation: {c.relation}</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400"><DateDisplay date={c.death_date} /></td>
                    <td className="px-6 py-4 font-mono font-semibold text-emerald-600"><MoneyDisplay amount={c.amount} /></td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                        c.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : c.status === 'verified' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right rtl:text-left space-x-2 rtl:space-x-reverse">
                      {c.status === 'registered' && (
                        <Button variant="outline" size="sm" onClick={() => handleVerify(c.id)}>
                          <CheckCircle className="w-4 h-4 text-sky-600" />
                          Verify
                        </Button>
                      )}
                      {c.status === 'verified' && (
                        <Button variant="primary" size="sm" onClick={() => openReleaseModal(c)}>
                          <HeartHandshake className="w-4 h-4" />
                          Release Payout
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Register Death Case Dialog */}
      <Dialog isOpen={showRegisterDialog} onClose={() => setShowRegisterDialog(false)} title={t('registerDeathCase')}>
        <form onSubmit={handleRegisterSubmit} className="space-y-4 py-2">
          <div>
            <label className="block text-xs font-semibold mb-1">Select Member *</label>
            <MemberPicker
              selectedMemberId={formData.member_id}
              onSelect={(id, obj) => {
                setFormData({
                  ...formData,
                  member_id: id,
                  deceased_name: formData.relation === 'self' ? obj.name : formData.deceased_name,
                });
              }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Deceased Name *</label>
              <input
                type="text"
                value={formData.deceased_name}
                onChange={(e) => setFormData({ ...formData, deceased_name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Relation to Member *</label>
              <select
                value={formData.relation}
                onChange={(e) => setFormData({ ...formData, relation: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800 capitalize"
              >
                {RELATIONS.map((r) => (
                  <option key={r} value={r} className="capitalize">{r}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Date of Death *</label>
            <input
              type="date"
              value={formData.death_date}
              onChange={(e) => setFormData({ ...formData, death_date: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" onClick={() => setShowRegisterDialog(false)}>{t('cancel')}</Button>
            <Button variant="primary" type="submit" loading={submitting}>Register Case</Button>
          </div>
        </form>
      </Dialog>

      {/* Release Payout Modal (BR-21, BR-25, BR-26) */}
      <Dialog isOpen={!!releaseCase} onClose={() => setReleaseCase(null)} title="Release Death Support Payout">
        {releaseCase && (
          <form onSubmit={handleReleaseSubmit} className="space-y-4 py-2">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Case Reference:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{releaseCase.ref}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Deceased:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{releaseCase.deceased_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Payout Amount:</span>
                <MoneyDisplay amount={releaseCase.amount} className="font-bold text-emerald-600" />
              </div>
              {/* BR-21 Information Display of member remaining dues */}
              {releaseMemberInfo && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-amber-700 dark:text-amber-300 flex items-center justify-between">
                  <span>Member Dues Status (Info Only):</span>
                  <span className="font-bold font-mono">Owes <MoneyDisplay amount={releaseMemberInfo.summary?.remaining} /></span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">{t('deficitReason')} (Required if balance becomes negative)</label>
              <textarea
                value={deficitReason}
                onChange={(e) => setDeficitReason(e.target.value)}
                rows={2}
                placeholder="e.g. Urgent family relief provided during temporary deficit"
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" onClick={() => setReleaseCase(null)}>{t('cancel')}</Button>
              <Button variant="primary" type="submit" loading={submitting}>Confirm & Release Rs. 70,000</Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
