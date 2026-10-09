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
import { UserPlus, Edit, UserCheck, UserX, Heart, ArrowLeft, ArrowRight, Trash2 } from 'lucide-react';

export function AdminMembers() {
  const { t, isRtl } = useI18n();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [items, setItems] = useState([]);
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
    opening_balance: 0,
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

  useEffect(() => {
    fetchMembers();
  }, [search, statusFilter, page]);

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
      opening_balance: 0,
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
              <div>
                <label className="block text-xs font-semibold mb-1">Opening Balance Dues (Rs.)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.opening_balance}
                  onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800"
                />
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
