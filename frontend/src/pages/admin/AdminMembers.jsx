import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useI18n } from '../../hooks/useI18n.js';
import { useToast } from '../../hooks/useToast.js';
import { members as membersService } from '../../services/index.js';
import { MoneyDisplay } from '../../components/common/MoneyDisplay.jsx';
import { DateDisplay } from '../../components/common/DateDisplay.jsx';
import { SearchInput } from '../../components/common/SearchInput.jsx';
import { Button } from '../../components/common/Button.jsx';
import { Dialog } from '../../components/common/Dialog.jsx';
import { ConfirmDialog } from '../../components/common/ConfirmDialog.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { formatMobile, formatCoverageSummary } from '../../lib/format.js';
import { COVERAGE_KEYS } from '../../constants/index.js';
import { UserPlus, Edit, UserCheck, UserX, Heart, ArrowLeft, ArrowRight, Trash2, CheckCircle, XCircle, Clock } from 'lucide-react';

const EXECUTIVE_COLORS = [
  { bg: 'bg-indigo-50 dark:bg-indigo-950/60', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-800', badge: 'bg-indigo-500' },
  { bg: 'bg-purple-50 dark:bg-purple-950/60', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800', badge: 'bg-purple-500' },
  { bg: 'bg-cyan-50 dark:bg-cyan-950/60', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-200 dark:border-cyan-800', badge: 'bg-cyan-500' },
  { bg: 'bg-teal-50 dark:bg-teal-950/60', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-200 dark:border-teal-800', badge: 'bg-teal-500' },
  { bg: 'bg-rose-50 dark:bg-rose-950/60', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800', badge: 'bg-rose-500' },
  { bg: 'bg-amber-50 dark:bg-amber-950/60', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800', badge: 'bg-amber-500' },
  { bg: 'bg-emerald-50 dark:bg-emerald-950/60', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800', badge: 'bg-emerald-500' },
  { bg: 'bg-blue-50 dark:bg-blue-950/60', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800', badge: 'bg-blue-500' },
];

function getExecutiveColor(execName = '') {
  if (!execName) return EXECUTIVE_COLORS[0];
  let hash = 0;
  for (let i = 0; i < execName.length; i++) {
    hash = execName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % EXECUTIVE_COLORS.length;
  return EXECUTIVE_COLORS[index];
}

export function AdminMembers() {
  const { t, isRtl } = useI18n();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [items, setItems] = useState([]);
  const [pendingItems, setPendingItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Dialog States
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [coverageMember, setCoverageMember] = useState(null);
  const [continueMember, setContinueMember] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [deleteMemberConfirm, setDeleteMemberConfirm] = useState(null);

  // Form State
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

  const [coverageData, setCoverageData] = useState({});
  const [continueData, setContinueData] = useState({
    name: '',
    father_name: '',
    mobile: '',
    cnic: '',
    address: '',
    join_date: new Date().toISOString().split('T')[0],
    duesChoice: 'carry',
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setShowAddDialog(true);
      searchParams.delete('action');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const res = await membersService.list({ search, status: statusFilter, page, pageSize: 25 });
      setItems(Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : []);
      setTotal(res?.total || 0);
    } catch (err) {
      toast.error(err.message || 'Failed to load members.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPending = async () => {
    try {
      if (membersService.listPending) {
        const pList = await membersService.listPending();
        setPendingItems(pList || []);
      }
    } catch (err) {
      console.warn('Could not load pending submissions:', err.message);
    }
  };

  useEffect(() => {
    fetchMembers();
    fetchPending();
  }, [search, statusFilter, page]);

  const handleApproveSubmission = async (id, name) => {
    try {
      await membersService.approveSubmission(id);
      toast.success(`Member submission for "${name}" approved!`);
      fetchPending();
      fetchMembers();
    } catch (err) {
      toast.error(err.message || 'Failed to approve submission.');
    }
  };

  const handleRejectSubmission = async (id, name) => {
    try {
      await membersService.rejectSubmission(id);
      toast.success(`Member submission for "${name}" rejected.`);
      fetchPending();
      fetchMembers();
    } catch (err) {
      toast.error(err.message || 'Failed to reject submission.');
    }
  };

  const handleAddSubmit = async (e, confirmDup = false) => {
    if (e) e.preventDefault();
    setSubmitting(true);
    try {
      await membersService.add(formData, { confirmDuplicate: confirmDup });
      toast.success(`Member "${formData.name}" added successfully.`);
      setShowAddDialog(false);
      setDuplicateWarning(null);
      resetForm();
      fetchMembers();
    } catch (err) {
      if (err.code === 'DUPLICATE_MOBILE') {
        setDuplicateWarning({
          message: err.message,
          duplicate: err.duplicate,
          pendingAction: 'add',
        });
      } else {
        toast.error(err.message || 'Failed to add member.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e, confirmDup = false) => {
    if (e) e.preventDefault();
    if (!editMember) return;
    setSubmitting(true);
    try {
      await membersService.edit(editMember.id, formData, { confirmDuplicate: confirmDup });
      toast.success(`Member "${formData.name}" updated.`);
      setEditMember(null);
      setDuplicateWarning(null);
      fetchMembers();
    } catch (err) {
      if (err.code === 'DUPLICATE_MOBILE') {
        setDuplicateWarning({
          message: err.message,
          duplicate: err.duplicate,
          pendingAction: 'edit',
        });
      } else {
        toast.error(err.message || 'Failed to edit member.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveCoverage = async () => {
    if (!coverageMember) return;
    setSubmitting(true);
    try {
      await membersService.saveCoverage(coverageMember.id, coverageData);
      toast.success('Dependent coverage updated.');
      setCoverageMember(null);
      fetchMembers();
    } catch (err) {
      toast.error(err.message || 'Failed to save coverage.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinueSubmit = async (e) => {
    e.preventDefault();
    if (!continueMember) return;
    setSubmitting(true);
    try {
      await membersService.continueFamily(continueMember.id, continueData, {
        duesChoice: continueData.duesChoice,
      });
      toast.success('Family continuation member registered!');
      setContinueMember(null);
      fetchMembers();
    } catch (err) {
      toast.error(err.message || 'Failed to register continuation.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (member) => {
    const nextStatus = member.status === 'active' ? 'inactive' : 'active';
    try {
      await membersService.setStatus(member.id, nextStatus);
      toast.success(`Member status set to ${nextStatus}.`);
      fetchMembers();
    } catch (err) {
      toast.error(err.message || 'Failed to change status.');
    }
  };

  const handleDeleteMember = async () => {
    if (!deleteMemberConfirm) return;
    setSubmitting(true);
    try {
      await membersService.remove(deleteMemberConfirm.id);
      toast.success(`Member "${deleteMemberConfirm.name}" permanently deleted.`);
      setDeleteMemberConfirm(null);
      fetchMembers();
    } catch (err) {
      toast.error(err.message || 'Failed to delete member.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
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
  };

  const openEdit = (m) => {
    setEditMember(m);
    setFormData({
      name: m.name,
      father_name: m.father_name,
      mobile: m.mobile,
      cnic: m.cnic || '',
      address: m.address || '',
      join_date: m.join_date,
      opening_balance: m.opening_balance || 0,
    });
  };

  const openCoverage = (m) => {
    setCoverageMember(m);
    setCoverageData(m.coverage || {});
  };

  const openContinue = (m) => {
    setContinueMember(m);
    setContinueData({
      name: '',
      father_name: m.name,
      mobile: m.mobile,
      cnic: '',
      address: m.address || '',
      join_date: new Date().toISOString().split('T')[0],
      duesChoice: 'carry',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('navMembers')}</h1>
          <p className="text-xs text-slate-500">Manage member directory, dues, coverage & continuation</p>
        </div>
        <Button variant="primary" onClick={() => { resetForm(); setShowAddDialog(true); }}>
          <UserPlus className="w-4 h-4" />
          {t('addMember')}
        </Button>
      </div>

      {/* Pending Submissions Queue */}
      {pendingItems.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <h2 className="text-base font-bold text-amber-950 dark:text-amber-200">
                Pending Member Approvals ({pendingItems.length})
              </h2>
            </div>
            <span className="text-xs text-amber-800 dark:text-amber-300 font-medium">
              Submitted by Executives for your review
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingItems.map((p) => (
              <div
                key={p.id}
                className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/80 rounded-xl p-4 flex flex-col justify-between gap-3 shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white text-base">{p.name}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                      Pending
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    S/o {p.father_name} · Mobile: <span className="font-mono text-slate-700 dark:text-slate-300">{p.mobile}</span>
                  </p>
                  <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">Submitted by:</span>
                      {(() => {
                        const execName = p.submitted_by_executive_name || 'Executive';
                        const color = getExecutiveColor(execName);
                        return (
                          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${color.bg} ${color.text} ${color.border}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${color.badge}`} />
                            {execName}
                          </span>
                        );
                      })()}
                    </div>
                    {Number(p.opening_balance || 0) > 0 && (
                      <div>
                        {Number(p.opening_balance) === 2000
                          ? 'One-Time Entry Fee: Rs. 2,000'
                          : `Carried Dues: Rs. ${p.opening_balance}`}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    onClick={() => handleRejectSubmission(p.id, p.name)}
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-500"
                    onClick={() => handleApproveSubmission(p.id, p.name)}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve Member
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          {['all', 'active', 'inactive', 'deceased'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                statusFilter === st
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
        <SearchInput value={search} onChange={setSearch} className="w-full sm:w-72" />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <LoadingSpinner text="Loading members list..." />
        ) : items.length === 0 ? (
          <EmptyState title="No members found" description="Try clearing your search filters or add a new member." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left rtl:text-right">
              <thead className="bg-slate-50 dark:bg-slate-800 text-xs text-slate-500 uppercase font-semibold border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3">{t('memberName')}</th>
                  <th className="px-6 py-3">{t('mobile')}</th>
                  <th className="px-6 py-3">Coverage & Address</th>
                  <th className="px-6 py-3">{t('status')}</th>
                  <th className="px-6 py-3">{t('paid')}</th>
                  <th className="px-6 py-3">{t('remaining')}</th>
                  <th className="px-6 py-3 text-right rtl:text-left">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900 dark:text-white">{m.name}</div>
                      <div className="text-xs text-slate-500">S/o {m.father_name} · Joined <DateDisplay date={m.join_date} /></div>
                      {(() => {
                        const execName = m.submitted_by_executive_name || (m.submitted_by_executive_id ? 'Executive' : null);
                        if (!execName) return null;
                        const color = getExecutiveColor(execName);
                        const isPending = m.approval_status === 'pending';

                        return (
                          <div className={`inline-flex items-center gap-1.5 text-[11px] font-bold mt-1.5 px-2.5 py-0.5 rounded-full border ${color.bg} ${color.text} ${color.border}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${color.badge}`} />
                            <span>
                              {isPending ? `⏳ Pending Approval · Entered by: ${execName}` : `Entered by: ${execName}`}
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-600 dark:text-slate-400">{formatMobile(m.mobile)}</td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      <div className="font-medium text-emerald-700 dark:text-emerald-400">{formatCoverageSummary(m.coverage)}</div>
                      <div className="truncate max-w-xs">{m.address || '—'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        m.status === 'active' ? 'bg-emerald-100 text-emerald-800' : m.status === 'deceased' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {t(m.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-emerald-600"><MoneyDisplay amount={m.summary?.paid} /></td>
                    <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300"><MoneyDisplay amount={m.summary?.remaining} /></td>
                    <td className="px-6 py-4 text-right rtl:text-left space-x-1 rtl:space-x-reverse">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(m)} title="Edit Member">
                        <Edit className="w-4 h-4 text-slate-500" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openCoverage(m)} title="Dependents Coverage">
                        <Heart className="w-4 h-4 text-rose-500" />
                      </Button>
                      {m.status === 'deceased' && !m.continued_by && (
                        <Button variant="outline" size="sm" onClick={() => openContinue(m)}>
                          Continue Family
                        </Button>
                      )}
                      {m.status === 'active' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleStatus(m)}
                          title="Deactivate / Archive Member"
                        >
                          <UserX className="w-4 h-4 text-slate-400" />
                        </Button>
                      )}
                      {m.status === 'inactive' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(m)}
                            title="Restore Member"
                          >
                            <UserCheck className="w-4 h-4 text-emerald-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteMemberConfirm(m)}
                            title="Delete Member"
                          >
                            <Trash2 className="w-4 h-4 text-rose-600" />
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > 25 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>Showing Page {page} of {Math.ceil(total / 25)}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                {isRtl ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
              </Button>
              <Button variant="outline" size="sm" disabled={page * 25 >= total} onClick={() => setPage((p) => p + 1)}>
                {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Member Dialog */}
      <Dialog
        isOpen={showAddDialog || !!editMember}
        onClose={() => { setShowAddDialog(false); setEditMember(null); }}
        title={editMember ? t('editMember') : t('addMember')}
      >
        <form onSubmit={editMember ? handleEditSubmit : handleAddSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">{t('memberName')} *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">{t('fatherName')} *</label>
              <input
                type="text"
                value={formData.father_name}
                onChange={(e) => setFormData({ ...formData, father_name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">{t('mobile')} *</label>
              <input
                type="text"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                placeholder="03001234567"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">{t('cnic')} (Optional)</label>
              <input
                type="text"
                value={formData.cnic}
                onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
                placeholder="35202-1234567-1"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">{t('joinDate')} *</label>
              <input
                type="date"
                value={formData.join_date}
                onChange={(e) => setFormData({ ...formData, join_date: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800"
                required
              />
            </div>
            {!editMember && (
              <div className="sm:col-span-2 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 mt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Member Category & Entry Fee
                  </label>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    Default: New Member (Rs. 2,000)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, memberType: 'new', opening_balance: 2000 }))}
                    className={`p-2.5 rounded-lg border text-left text-xs font-semibold transition ${
                      formData.memberType !== 'existing'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-bold text-slate-900 dark:text-white">✨ New Member</div>
                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">One-Time Entry Fee: Rs. 2,000</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, memberType: 'existing', opening_balance: 0 }))}
                    className={`p-2.5 rounded-lg border text-left text-xs font-semibold transition ${
                      formData.memberType === 'existing'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-bold text-slate-900 dark:text-white">👤 Old / Existing Member</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Custom Carried Dues</div>
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    {formData.memberType === 'existing' ? 'Carried Dues / Previous Balance (Rs.)' : 'One-Time Entry Fee (Rs.)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.opening_balance}
                    onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">{t('address')} (Optional)</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" onClick={() => { setShowAddDialog(false); setEditMember(null); }}>
              {t('cancel')}
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              {t('save')}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Duplicate Mobile Warning Dialog (BR-16) */}
      {duplicateWarning && (
        <ConfirmDialog
          isOpen={!!duplicateWarning}
          onClose={() => setDuplicateWarning(null)}
          title="Duplicate Mobile Warning"
          message={`Warning: Mobile number is already registered to existing member "${duplicateWarning.duplicate?.name}". Do you still want to proceed?`}
          confirmText="Continue Anyway"
          onConfirm={() => {
            if (duplicateWarning.pendingAction === 'add') handleAddSubmit(null, true);
            if (duplicateWarning.pendingAction === 'edit') handleEditSubmit(null, true);
          }}
          loading={submitting}
        />
      )}

      {/* Delete Member Confirmation Dialog */}
      {deleteMemberConfirm && (
        <ConfirmDialog
          isOpen={!!deleteMemberConfirm}
          onClose={() => setDeleteMemberConfirm(null)}
          title="Delete Member"
          message={`Are you sure you want to permanently delete member "${deleteMemberConfirm.name}"?`}
          confirmText="Delete Member"
          variant="danger"
          onConfirm={handleDeleteMember}
          loading={submitting}
        />
      )}

      {/* Dependent Coverage Dialog (BR-18) */}
      <Dialog
        isOpen={!!coverageMember}
        onClose={() => setCoverageMember(null)}
        title={`Dependent Coverage — ${coverageMember?.name}`}
      >
        <div className="space-y-4 py-2">
          <p className="text-xs text-slate-500">Counts for covered dependents (0 to 20 per category). Registered member is covered automatically.</p>
          <div className="grid grid-cols-2 gap-3">
            {COVERAGE_KEYS.map((key) => (
              <div key={key} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
                <span className="text-xs font-medium capitalize">{key}</span>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={coverageData[key] || 0}
                  onChange={(e) => setCoverageData({ ...coverageData, [key]: parseInt(e.target.value) || 0 })}
                  className="w-16 px-2 py-1 text-xs text-center font-mono border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" onClick={() => setCoverageMember(null)}>
              {t('cancel')}
            </Button>
            <Button variant="primary" onClick={handleSaveCoverage} loading={submitting}>
              Save Coverage
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Continue Family Dialog (BR-19) */}
      <Dialog
        isOpen={!!continueMember}
        onClose={() => setContinueMember(null)}
        title={`Continue Family — ${continueMember?.name}`}
      >
        <form onSubmit={handleContinueSubmit} className="space-y-4 py-2">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200">
            Register successor member for deceased member <strong>{continueMember?.name}</strong>.
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Successor Member Name *</label>
            <input
              type="text"
              value={continueData.name}
              onChange={(e) => setContinueData({ ...continueData, name: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">{t('mobile')} *</label>
              <input
                type="text"
                value={continueData.mobile}
                onChange={(e) => setContinueData({ ...continueData, mobile: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Unpaid Dues Handling</label>
              <select
                value={continueData.duesChoice}
                onChange={(e) => setContinueData({ ...continueData, duesChoice: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800"
              >
                <option value="carry">Carry Over Dues</option>
                <option value="waive">Waive Dues (Set to 0)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" onClick={() => setContinueMember(null)}>
              {t('cancel')}
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Register Successor
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
