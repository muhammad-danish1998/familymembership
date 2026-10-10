import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useI18n } from '../../hooks/useI18n.js';
import { family } from '../../services/index.js';
import { MoneyDisplay } from '../../components/common/MoneyDisplay.jsx';
import { DateDisplay } from '../../components/common/DateDisplay.jsx';
import { SearchInput } from '../../components/common/SearchInput.jsx';
import { Dialog } from '../../components/common/Dialog.jsx';
import { Button } from '../../components/common/Button.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { formatMobile, formatCoverageSummary, formatMoney } from '../../lib/format.js';
import { KeyRound, ShieldAlert, Users, TrendingUp, HeartHandshake, Lock, ArrowLeft, ArrowRight, ShieldCheck, UserCheck, AlertTriangle } from 'lucide-react';

export function FamilyPage() {
  const { t, isRtl } = useI18n();
  const { id: routeMemberId } = useParams();
  const navigate = useNavigate();

  // Authentication State
  const [token, setToken] = useState(() => sessionStorage.getItem('ff_family_token'));
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  // Fund Data State
  const [summary, setSummary] = useState(null);
  const [members, setMembers] = useState([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Selected Member Detail State
  const [selectedMember, setSelectedMember] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Load summary and member list once token exists
  useEffect(() => {
    if (!token) return;

    let active = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const [sumRes, memRes] = await Promise.all([
          family.getSummary(token),
          family.listMembers(token, { search, page, pageSize: 20 }),
        ]);
        if (active) {
          setSummary(sumRes);
          setMembers(memRes.items);
          setTotalMembers(memRes.total);
        }
      } catch (err) {
        if (active && (err.code === 'WRONG_PIN' || err.code === 'NOT_AUTHORIZED')) {
          sessionStorage.removeItem('ff_family_token');
          setToken(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();
    return () => {
      active = false;
    };
  }, [token, search, page]);

  // Handle member selection via route or click
  useEffect(() => {
    if (!token || !routeMemberId) {
      setSelectedMember(null);
      return;
    }
    let active = true;
    const loadMember = async () => {
      setDetailLoading(true);
      try {
        const res = await family.getMember(token, routeMemberId);
        if (active) setSelectedMember(res);
      } catch (err) {
        console.error('Failed to load member detail:', err);
      } finally {
        if (active) setDetailLoading(false);
      }
    };
    loadMember();
    return () => {
      active = false;
    };
  }, [token, routeMemberId]);

  const handlePinSubmit = async (e) => {
    e.preventDefault();
    setPinError('');
    setPinLoading(true);
    try {
      const res = await family.login(pin);
      sessionStorage.setItem('ff_family_token', res.token);
      setToken(res.token);
      setPin('');
    } catch (err) {
      setPinError(err.message || t('wrongPin'));
    } finally {
      setPinLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Render PIN Gate Modal if not authenticated
  // -------------------------------------------------------------
  if (!token) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-6">
          <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-7 h-7" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('enterPinPrompt')}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Enter the shared PIN to view the family support fund status.
            </p>
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <div className="relative">
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="******"
                  maxLength={8}
                  className="w-full text-center tracking-widest text-2xl font-mono px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
                <KeyRound className="w-5 h-5 absolute right-4 top-4 text-slate-400 rtl:left-4 rtl:right-auto pointer-events-none" />
              </div>
              {pinError && <p className="text-xs font-semibold text-rose-600 mt-2">{pinError}</p>}
            </div>

            <Button type="submit" variant="primary" size="lg" className="w-full" loading={pinLoading}>
              {t('loginButton')}
            </Button>
          </form>

          <p className="text-xs text-slate-400">Default Demo PIN: <code className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">123456</code></p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Render Family Fund Main View
  // -------------------------------------------------------------
  return (
    <div className="space-y-8">
      {/* Shortfall & Low Balance Banners (BR-27 & BR-28) */}
      {summary && summary.isShortfall && (
        <div className="bg-rose-500/10 border-2 border-rose-500/30 rounded-2xl p-5 text-rose-900 dark:text-rose-200 flex items-start gap-4">
          <ShieldAlert className="w-8 h-8 text-rose-600 shrink-0 mt-1" />
          <div>
            <h3 className="font-bold text-lg">{t('shortfallBannerTitle')}</h3>
            <p className="text-sm mt-1 leading-relaxed">
              {t('shortfallMessage', {
                shortfall: formatMoney(summary.shortfall),
                share: formatMoney(summary.perMemberShare),
              })}
            </p>
          </div>
        </div>
      )}

      {summary && summary.isLowBalance && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-amber-900 dark:text-amber-200 flex items-center gap-3">
          <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0" />
          <p className="text-sm font-medium">
            {t('lowBalanceWarning', {
              balance: formatMoney(summary.balance),
            })}
          </p>
        </div>
      )}

      {/* Fund Summary Stat Cards (BR-24) */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">{t('totalCollected')}</span>
              <MoneyDisplay amount={summary.collected} className="text-2xl font-bold text-slate-900 dark:text-white mt-1" />
              <span className="text-[11px] text-slate-500 block mt-1">Still to collect: <MoneyDisplay amount={summary.stillToCollect || 0} /></span>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded-xl">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">{t('totalPaidOut')}</span>
              <MoneyDisplay amount={summary.paidOut} className="text-2xl font-bold text-slate-900 dark:text-white mt-1" />
              <span className="text-[11px] text-slate-500 block mt-1">{summary.paidCasesCount || 0} death case(s) supported</span>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-950 text-rose-600 rounded-xl">
              <HeartHandshake className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">{t('fundBalance')}</span>
              <MoneyDisplay
                amount={summary.balance}
                highlight
                className="text-2xl font-bold mt-1"
              />
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded-xl">
              <Lock className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">{t('activeMembers')}</span>
              <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 block">{summary.activeMembersCount}</span>
              <span className="text-[11px] text-slate-500 block mt-1">{summary.fullyPaidCount || 0} fully paid · {summary.behindCount || 0} behind</span>
            </div>
            <div className="p-3 bg-sky-50 dark:bg-sky-950 text-sky-600 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
          </div>
        </div>
      )}

      {/* Member Directory Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('navMembers')}</h3>
            <p className="text-xs text-slate-500">Read-only view of registered fund members & payment status</p>
          </div>
          <SearchInput value={search} onChange={setSearch} className="w-full sm:w-72" />
        </div>

        {loading ? (
          <LoadingSpinner text="Loading members..." />
        ) : members.length === 0 ? (
          <EmptyState title="No members found" description="No registered members match your search criteria." />
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left rtl:text-right">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 uppercase font-semibold border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-3">{t('memberName')}</th>
                    <th className="px-6 py-3">{t('fatherName')}</th>
                    <th className="px-6 py-3">{t('mobile')}</th>
                    <th className="px-6 py-3">{t('status')}</th>
                    <th className="px-6 py-3">{t('enteredBy')}</th>
                    <th className="px-6 py-3">{t('paid')}</th>
                    <th className="px-6 py-3">{t('remaining')}</th>
                    <th className="px-6 py-3 text-right rtl:text-left">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {members.map((m) => {
                    const isUnapproved = m.approval_status === 'pending' || m.approval_status === 'rejected';
                    return (
                      <tr
                        key={m.id}
                        className={`transition-colors ${
                          isUnapproved
                            ? 'bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100/70 dark:hover:bg-rose-900/40 border-l-4 border-l-rose-500 dark:border-l-rose-500'
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{m.name}</td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{m.father_name}</td>
                        <td className="px-6 py-4 font-mono text-slate-600 dark:text-slate-400">{formatMobile(m.mobile)}</td>
                        <td className="px-6 py-4">
                          {m.status === 'deceased' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                              {t('deceased')}
                            </span>
                          ) : m.isFullyPaid ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              Fully paid
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              Partial
                            </span>
                          )}
                          {m.isBehind && (
                            <span className="ml-2 rtl:mr-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                              Behind <MoneyDisplay amount={m.behindBy} className="ml-1" />
                            </span>
                          )}
                        </td>

                        {/* Entry Source & Admin Approval Status */}
                        <td className="px-6 py-4">
                          {isUnapproved ? (
                            <div className="flex flex-col gap-1 items-start">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-rose-600 text-white dark:bg-rose-600 dark:text-white border border-rose-700 animate-pulse shadow-xs">
                                <AlertTriangle className="w-3.5 h-3.5 text-white shrink-0" />
                                {t('notApprovedByAdmin')}
                              </span>
                              <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 pl-0.5">
                                {m.submitted_by_executive_name
                                  ? t('enteredByExecutive', { name: m.submitted_by_executive_name })
                                  : t('enteredByAdmin')}
                              </span>
                            </div>
                          ) : m.submitted_by_executive_name ? (
                            <div className="flex flex-col gap-0.5 items-start">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                {t('approvedByAdmin')}
                              </span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 pl-0.5">
                                {t('enteredByExecutive', { name: m.submitted_by_executive_name })}
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-0.5 items-start">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                <UserCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                {t('enteredByAdmin')}
                              </span>
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 pl-0.5 font-medium">
                                ✓ {t('approvedByAdmin')}
                              </span>
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4"><MoneyDisplay amount={m.paid} className="font-medium text-emerald-600" /></td>
                        <td className="px-6 py-4">
                          {m.status === 'deceased' ? (
                            <span className="text-slate-400 font-semibold">—</span>
                          ) : (
                            <MoneyDisplay amount={m.remaining} className="font-medium text-slate-700 dark:text-slate-300" />
                          )}
                        </td>
                        <td className="px-6 py-4 text-right rtl:text-left">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/family/member/${m.id}`)}
                          >
                            Details
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Native Card View */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {members.map((m) => {
                const isUnapproved = m.approval_status === 'pending' || m.approval_status === 'rejected';
                return (
                  <div
                    key={m.id}
                    className={`p-4 space-y-3 transition-colors ${
                      isUnapproved
                        ? 'bg-rose-50/80 dark:bg-rose-950/40 border-l-4 border-l-rose-500'
                        : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-base text-slate-900 dark:text-white">{m.name}</h4>
                        <p className="text-xs text-slate-500">S/O {m.father_name} · <span className="font-mono">{formatMobile(m.mobile)}</span></p>
                      </div>

                      {/* Member Status Badge */}
                      {m.status === 'deceased' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                          Deceased
                        </span>
                      ) : m.isFullyPaid ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          Fully paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          Partial
                        </span>
                      )}
                    </div>

                    {/* Entry Source & Unapproved Danger Banner */}
                    <div>
                      {isUnapproved ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold bg-rose-600 text-white animate-pulse">
                          <AlertTriangle className="w-4 h-4 text-white" />
                          <span>⚠️ {t('notApprovedByAdmin')} ({m.submitted_by_executive_name ? t('enteredByExecutive', { name: m.submitted_by_executive_name }) : t('enteredByAdmin')})</span>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">
                          {m.submitted_by_executive_name ? t('enteredByExecutive', { name: m.submitted_by_executive_name }) : t('enteredByAdmin')}
                          {' · '}
                          <span className="text-emerald-600 font-semibold">✓ {t('approvedByAdmin')}</span>
                        </p>
                      )}
                    </div>

                    {/* Financial Summary */}
                    <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs">
                      <div>
                        <span className="text-slate-400 block">{t('paid')}</span>
                        <MoneyDisplay amount={m.paid} className="font-bold text-emerald-600 text-sm" />
                      </div>
                      <div>
                        <span className="text-slate-400 block">{t('remaining')}</span>
                        <MoneyDisplay amount={m.remaining} className="font-bold text-slate-800 dark:text-slate-200 text-sm" />
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full font-bold"
                      onClick={() => navigate(`/family/member/${m.id}`)}
                    >
                      View Member Statement
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalMembers > 20 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>Showing Page {page} of {Math.ceil(totalMembers / 20)}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {isRtl ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page * 20 >= totalMembers}
                onClick={() => setPage((p) => p + 1)}
              >
                {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Member Detail Dialog Modal */}
      <Dialog
        isOpen={!!selectedMember}
        onClose={() => navigate('/family')}
        title={selectedMember ? `${selectedMember.name} — Member Statement` : ''}
        maxWidth="max-w-3xl"
      >
        {detailLoading || !selectedMember ? (
          <LoadingSpinner text="Loading member details..." />
        ) : (
          <div className="space-y-6 py-2">
            {/* Entry Source & Admin Approval Status Banner */}
            {selectedMember.approval_status === 'pending' || selectedMember.approval_status === 'rejected' ? (
              <div className="p-4 rounded-xl border-2 border-rose-500 bg-rose-500/10 dark:bg-rose-950/60 text-rose-900 dark:text-rose-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-xs shrink-0 animate-bounce">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-base text-rose-700 dark:text-rose-300 flex items-center gap-2">
                      ⚠️ {t('notApprovedByAdmin')}
                    </h4>
                    <p className="text-xs text-rose-800 dark:text-rose-200 mt-1">
                      {selectedMember.submitted_by_executive_name
                        ? t('enteredByExecutive', { name: selectedMember.submitted_by_executive_name })
                        : t('enteredByAdmin')}
                      {' · '}
                      <span className="font-bold underline">{t('pendingAdminApproval')}</span>
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-rose-600 text-white text-xs font-black uppercase tracking-wider rounded-full shadow-xs shrink-0">
                  Unapproved Entry
                </span>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold text-emerald-900 dark:text-emerald-200">{t('approvedByAdmin')}</span>
                    <span className="text-emerald-700 dark:text-emerald-400 ml-2 rtl:mr-2">
                      ({selectedMember.submitted_by_executive_name
                        ? t('enteredByExecutive', { name: selectedMember.submitted_by_executive_name })
                        : t('enteredByAdmin')})
                    </span>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-bold text-[11px]">
                  ✓ Approved
                </span>
              </div>
            )}

            {/* Header info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs">
              <div>
                <span className="text-slate-400 block">{t('fatherName')}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedMember.father_name}</span>
              </div>
              <div>
                <span className="text-slate-400 block">{t('joinDate')}</span>
                <DateDisplay date={selectedMember.join_date} className="font-semibold text-slate-800 dark:text-slate-200" />
              </div>
              <div>
                <span className="text-slate-400 block">{t('totalDue')}</span>
                <MoneyDisplay amount={selectedMember.summary.totalDue} className="font-bold text-slate-800 dark:text-slate-200" />
              </div>
              <div>
                <span className="text-slate-400 block">{t('remaining')}</span>
                <MoneyDisplay amount={selectedMember.summary.remaining} className="font-bold text-emerald-600" />
              </div>
            </div>

            {/* Coverage Summary (BR-18) */}
            <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 rounded-xl text-xs">
              <span className="font-bold text-emerald-900 dark:text-emerald-300 block mb-1">{t('coverage')}:</span>
              <span className="text-emerald-700 dark:text-emerald-400">{formatCoverageSummary(selectedMember.coverage)}</span>
            </div>

            {/* Yearly Schedule Breakdown (BR-7) */}
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-2">{t('yearView')}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                {selectedMember.yearView.years.map((y, idx) => (
                  <div key={idx} className="p-3 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between">
                    <div>
                      <span className="font-bold block">{y.yearLabel}</span>
                      <span className="text-slate-400">Due: <MoneyDisplay amount={y.due} /></span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded font-semibold text-[10px] ${
                        y.status === 'Paid'
                          ? 'bg-emerald-100 text-emerald-800'
                          : y.status === 'Partial'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {y.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment History */}
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-2">{t('paymentHistory')}</h4>
              {selectedMember.payments.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No payment transactions recorded yet.</p>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left rtl:text-right">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold border-b border-slate-100 dark:border-slate-800">
                      <tr>
                        <th className="p-2.5">{t('date')}</th>
                        <th className="p-2.5">{t('amount')}</th>
                        <th className="p-2.5">Received By</th>
                        <th className="p-2.5">{t('notes')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {selectedMember.payments.map((p) => (
                        <tr key={p.id} className={p.type === 'reversal' ? 'bg-rose-50/50 text-rose-700' : ''}>
                          <td className="p-2.5"><DateDisplay date={p.payment_date} /></td>
                          <td className="p-2.5 font-mono font-semibold">
                            <MoneyDisplay amount={p.amount} negative={p.type === 'reversal'} />
                          </td>
                          <td className="p-2.5">{p.received_by}</td>
                          <td className="p-2.5 text-slate-500">{p.note || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
