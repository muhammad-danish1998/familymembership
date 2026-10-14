import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useI18n } from '../../hooks/useI18n.js';
import { useToast } from '../../hooks/useToast.js';
import { payments as paymentsService, executives as executivesService } from '../../services/index.js';
import { MoneyDisplay } from '../../components/common/MoneyDisplay.jsx';
import { DateDisplay } from '../../components/common/DateDisplay.jsx';
import { Button } from '../../components/common/Button.jsx';
import { Dialog } from '../../components/common/Dialog.jsx';
import { MemberPicker } from '../../components/common/MemberPicker.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { CreditCard, RotateCcw, Receipt, Copy, Check, MessageSquare, ArrowLeft, ArrowRight, Edit } from 'lucide-react';

export function AdminPayments() {
  const { t, isRtl } = useI18n();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [executives, setExecutives] = useState([]);

  // Modal States
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editPayment, setEditPayment] = useState(null);
  const [editFormData, setEditFormData] = useState({
    amount: '',
    date: '',
    executiveId: '',
    note: '',
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [reversePaymentId, setReversePaymentId] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [copied, setCopied] = useState(false);

  // Form States
  const [formData, setFormData] = useState({
    memberId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    executiveId: '',
    note: '',
  });

  const [reversalReason, setReversalReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedMemberObj, setSelectedMemberObj] = useState(null);

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setShowAddDialog(true);
      searchParams.delete('action');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const [payRes, execRes] = await Promise.all([
        paymentsService.list({ page, pageSize: 25 }),
        executivesService.list(),
      ]);
      setItems(payRes.items);
      setTotal(payRes.total);
      setExecutives(execRes.filter((e) => e.active));
    } catch (err) {
      toast.error(err.message || 'Failed to load payments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [page]);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.memberId) {
      toast.error('Please select a member first.');
      return;
    }
    setSubmitting(true);
    try {
      const newPay = await paymentsService.add({
        memberId: formData.memberId,
        amount: formData.amount,
        date: formData.date,
        executiveId: formData.executiveId || null,
        note: formData.note,
      });

      toast.success('Payment recorded successfully!');
      setShowAddDialog(false);
      resetForm();

      // Show receipt modal automatically
      const targetId = newPay?.id || newPay;
      const rc = await paymentsService.receipt(targetId);
      setReceiptData(rc);

      fetchPayments();
    } catch (err) {
      toast.error(err.message || 'Failed to record payment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReverseSubmit = async (e) => {
    e.preventDefault();
    if (!reversePaymentId) return;
    setSubmitting(true);
    try {
      await paymentsService.reverse(reversePaymentId, reversalReason);
      toast.success('Payment reversed.');
      setReversePaymentId(null);
      setReversalReason('');
      fetchPayments();
    } catch (err) {
      toast.error(err.message || 'Failed to reverse payment.');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditPayment = (p) => {
    setEditPayment(p);
    setEditFormData({
      amount: p.amount,
      date: p.payment_date,
      executiveId: p.executive_id || '',
      note: p.note || '',
    });
  };

  const handleEditPaymentSubmit = async (e) => {
    e.preventDefault();
    if (!editPayment) return;
    if (!editFormData.amount || Number(editFormData.amount) <= 0) {
      toast.error('Please enter a valid payment amount > 0.');
      return;
    }
    setEditSubmitting(true);
    try {
      await paymentsService.edit(editPayment.id, {
        amount: editFormData.amount,
        date: editFormData.date,
        executiveId: editFormData.executiveId || null,
        note: editFormData.note,
      });
      toast.success(`Payment #${editPayment.id} updated successfully.`);
      setEditPayment(null);
      fetchPayments();
    } catch (err) {
      toast.error(err.message || 'Failed to edit payment.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const openReceipt = async (paymentId) => {
    try {
      const rc = await paymentsService.receipt(paymentId);
      setReceiptData(rc);
    } catch (err) {
      toast.error(err.message || 'Failed to generate receipt.');
    }
  };

  const handleCopyText = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetForm = () => {
    setFormData({
      memberId: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      executiveId: '',
      note: '',
    });
    setSelectedMemberObj(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('navPayments')}</h1>
          <p className="text-xs text-slate-500">Record immutable payments, issue receipts & handle reversals</p>
        </div>
        <Button variant="primary" onClick={() => { resetForm(); setShowAddDialog(true); }}>
          <CreditCard className="w-4 h-4" />
          {t('recordPayment')}
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <LoadingSpinner text="Loading payment transactions..." />
        ) : items.length === 0 ? (
          <EmptyState title="No payments recorded" description="Click 'Record Payment' to enter a contribution." />
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left rtl:text-right">
                <thead className="bg-slate-50 dark:bg-slate-800 text-xs text-slate-500 uppercase font-semibold border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-3">Transaction ID</th>
                    <th className="px-6 py-3">{t('memberName')}</th>
                    <th className="px-6 py-3">{t('amount')}</th>
                    <th className="px-6 py-3">{t('date')}</th>
                    <th className="px-6 py-3">Received By</th>
                    <th className="px-6 py-3">{t('notes')}</th>
                    <th className="px-6 py-3 text-right rtl:text-left">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((p) => (
                    <tr key={p.id} className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${p.type === 'reversal' ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''}`}>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">#{p.id}</td>
                      <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{p.member_name}</td>
                      <td className="px-6 py-4 font-mono font-semibold">
                        <MoneyDisplay amount={p.amount} negative={p.type === 'reversal'} />
                        {p.is_reversed && (
                          <span className="ml-2 px-2 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 font-sans">Reversed</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400"><DateDisplay date={p.payment_date} /></td>
                      <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400">{p.received_by}</td>
                      <td className="px-6 py-4 text-xs text-slate-500 truncate max-w-xs">{p.note || '—'}</td>
                      <td className="px-6 py-4 text-right rtl:text-left space-x-1 rtl:space-x-reverse">
                        {p.type === 'payment' && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => openEditPayment(p)} title="Edit Payment">
                              <Edit className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openReceipt(p.id)} title="View Receipt">
                              <Receipt className="w-4 h-4 text-emerald-600" />
                            </Button>
                            {!p.is_reversed && (
                              <Button variant="ghost" size="sm" onClick={() => setReversePaymentId(p.id)} title="Reverse Payment">
                                <RotateCcw className="w-4 h-4 text-rose-500" />
                              </Button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Native Card View */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((p) => (
                <div
                  key={p.id}
                  className={`p-4 space-y-3 ${p.type === 'reversal' ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-base text-slate-900 dark:text-white">{p.member_name}</div>
                      <div className="text-xs text-slate-500 font-mono">Txn #{p.id} · <DateDisplay date={p.payment_date} /></div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-base">
                        <MoneyDisplay amount={p.amount} negative={p.type === 'reversal'} />
                      </div>
                      {p.is_reversed && (
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 font-semibold">
                          Reversed
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Received By</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{p.received_by || 'Admin Directly'}</span>
                    </div>
                    {p.note && (
                      <div className="text-right max-w-[55%]">
                        <span className="text-slate-400 block text-[11px]">Note / Ref</span>
                        <span className="text-slate-600 dark:text-slate-400 truncate block">{p.note}</span>
                      </div>
                    )}
                  </div>

                  {p.type === 'payment' && (
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditPayment(p)}
                        className="flex-1 text-sky-600 border-sky-200 dark:border-sky-800 justify-center font-semibold text-xs"
                      >
                        <Edit className="w-3.5 h-3.5 mr-1 rtl:mr-0 rtl:ml-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openReceipt(p.id)}
                        className="flex-1 text-emerald-600 border-emerald-200 dark:border-emerald-800 justify-center font-semibold text-xs"
                      >
                        <Receipt className="w-3.5 h-3.5 mr-1 rtl:mr-0 rtl:ml-1" />
                        Receipt
                      </Button>
                      {!p.is_reversed && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setReversePaymentId(p.id)}
                          className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-2.5"
                          title="Reverse Payment"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
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

      {/* Record Payment Dialog */}
      <Dialog isOpen={showAddDialog} onClose={() => setShowAddDialog(false)} title={t('recordPayment')}>
        <form onSubmit={handleAddSubmit} className="space-y-4 py-2">
          <div>
            <label className="block text-xs font-semibold mb-1">Select Member *</label>
            <MemberPicker
              selectedMemberId={formData.memberId}
              onSelect={(id, obj) => {
                setFormData({ ...formData, memberId: id });
                setSelectedMemberObj(obj);
              }}
            />
          </div>

          {selectedMemberObj && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-xs space-y-1 text-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center justify-between">
                <span>Selected Member: <strong>{selectedMemberObj.name}</strong></span>
                <span>Current Dues: <MoneyDisplay amount={selectedMemberObj.summary?.remaining} className="font-bold" /></span>
              </div>
              <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                Max payment limit: <MoneyDisplay amount={selectedMemberObj.summary?.maxPaymentAllowed || 12000} className="font-bold" /> (Current dues + up to 1 year advance payment cap).
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">{t('amount')} (Rs.) *</label>
              <input
                type="number"
                min="1"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="6000"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">{t('date')} *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Received By (Collector)</label>
            <select
              value={formData.executiveId}
              onChange={(e) => setFormData({ ...formData, executiveId: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800"
            >
              <option value="">Admin Direct</option>
              {executives.map((e) => (
                <option key={e.id} value={e.id}>{e.name} (Executive)</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">{t('notes')}</label>
            <input
              type="text"
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              placeholder="e.g. Installment 1 / Annual dues"
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" className="w-full sm:w-auto justify-center" onClick={() => setShowAddDialog(false)}>{t('cancel')}</Button>
            <Button variant="primary" type="submit" className="w-full sm:w-auto justify-center" loading={submitting}>{t('save')}</Button>
          </div>
        </form>
      </Dialog>

      {/* Edit Payment Dialog */}
      <Dialog isOpen={!!editPayment} onClose={() => setEditPayment(null)} title="Edit Payment Record">
        {editPayment && (
          <form onSubmit={handleEditPaymentSubmit} className="space-y-4 py-2">
            <div className="p-3 bg-sky-50 dark:bg-sky-950/40 rounded-xl text-xs space-y-1 border border-sky-200 dark:border-sky-800">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Member:</span>
                <span className="font-bold text-slate-900 dark:text-white">{editPayment.member_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Transaction ID:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">#{editPayment.id}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">{t('amount')} (Rs.) *</label>
                <input
                  type="number"
                  min="1"
                  value={editFormData.amount}
                  onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">{t('date')} *</label>
                <input
                  type="date"
                  value={editFormData.date}
                  onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Received By (Collector)</label>
              <select
                value={editFormData.executiveId}
                onChange={(e) => setEditFormData({ ...editFormData, executiveId: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800"
              >
                <option value="">Admin Directly (Default)</option>
                {executives.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name} (Executive)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">{t('notes')} / Reference (Optional)</label>
              <input
                type="text"
                value={editFormData.note}
                onChange={(e) => setEditFormData({ ...editFormData, note: e.target.value })}
                placeholder="Payment reference or bank transfer note..."
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" type="button" className="w-full sm:w-auto justify-center" onClick={() => setEditPayment(null)}>
                {t('cancel')}
              </Button>
              <Button variant="primary" type="submit" className="w-full sm:w-auto justify-center" loading={editSubmitting}>
                Save Changes
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* Reverse Payment Dialog (BR-12) */}
      <Dialog isOpen={!!reversePaymentId} onClose={() => setReversePaymentId(null)} title={t('reversePayment')}>
        <form onSubmit={handleReverseSubmit} className="space-y-4 py-2">
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-900 dark:text-rose-200">
            Reversal will create an immutable negative entry offsetting transaction #{reversePaymentId}. A written reason is required.
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">{t('reversalReason')} *</label>
            <textarea
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
              rows={3}
              placeholder="e.g. Entry error / wrong member selected by mistake"
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800"
              required
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" className="w-full sm:w-auto justify-center" onClick={() => setReversePaymentId(null)}>{t('cancel')}</Button>
            <Button variant="danger" type="submit" className="w-full sm:w-auto justify-center" loading={submitting}>Confirm Reversal</Button>
          </div>
        </form>
      </Dialog>

      {/* Receipt Modal (BR-14) */}
      <Dialog isOpen={!!receiptData} onClose={() => setReceiptData(null)} title="Payment Receipt">
        {receiptData && (
          <div className="space-y-6 py-2">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-2 font-mono text-xs border border-slate-200 dark:border-slate-700">
              <pre className="whitespace-pre-wrap font-sans text-slate-800 dark:text-slate-200">{receiptData.textEn}</pre>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" size="sm" className="w-full sm:w-auto justify-center" onClick={() => handleCopyText(receiptData.textEn)}>
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                {copied ? t('copied') : t('copy')} Text
              </Button>

              <a
                href={receiptData.whatsappUrlEn}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-xs w-full sm:w-auto text-center"
              >
                <MessageSquare className="w-4 h-4" />
                Share via WhatsApp
              </a>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
