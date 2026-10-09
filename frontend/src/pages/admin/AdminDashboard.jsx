import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../hooks/useI18n.js';
import { fund, payments, cases } from '../../services/index.js';
import { MoneyDisplay } from '../../components/common/MoneyDisplay.jsx';
import { Button } from '../../components/common/Button.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { DateDisplay } from '../../components/common/DateDisplay.jsx';
import { TrendingUp, HeartHandshake, Lock, Users, Plus, CreditCard, UserX, AlertCircle } from 'lucide-react';

export function AdminDashboard() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [recentPayments, setRecentPayments] = useState([]);
  const [recentCases, setRecentCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadDashboard = async () => {
      setLoading(true);
      try {
        const [sumData, payData, caseData] = await Promise.all([
          fund.getSummary(),
          payments.list({ page: 1, pageSize: 5 }),
          cases.list(),
        ]);
        if (active) {
          setSummary(sumData);
          const payList = Array.isArray(payData) ? payData : payData?.items || [];
          const caseList = Array.isArray(caseData) ? caseData : caseData?.items || [];
          setRecentPayments(payList.slice(0, 5));
          setRecentCases(caseList.slice(0, 5));
        }
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadDashboard();
    return () => {
      active = false;
    };
  }, []);

  if (loading || !summary) {
    return <LoadingSpinner text="Loading dashboard..." fullPage />;
  }

  return (
    <div className="space-y-8">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('navDashboard')}</h1>
          <p className="text-xs text-slate-500">Fund overview & quick admin controls</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={() => navigate('/admin/payments?action=add')}>
            <CreditCard className="w-4 h-4" />
            {t('recordPayment')}
          </Button>
          <Button variant="outline" onClick={() => navigate('/admin/members?action=add')}>
            <Plus className="w-4 h-4" />
            {t('addMember')}
          </Button>
          <Button variant="outline" onClick={() => navigate('/admin/death-support?action=add')}>
            <UserX className="w-4 h-4" />
            {t('registerDeathCase')}
          </Button>
        </div>
      </div>

      {/* Warnings if shortfall or low balance */}
      {summary.isShortfall && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>Fund Net Balance is negative (<MoneyDisplay amount={summary.balance} className="font-bold" />). Per member share to cover deficit: <MoneyDisplay amount={summary.perMemberShare} className="font-bold" />.</span>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">{t('totalCollected')}</span>
            <MoneyDisplay amount={summary.collected} className="text-2xl font-bold text-slate-900 dark:text-white mt-1" />
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">{t('totalPaidOut')}</span>
            <MoneyDisplay amount={summary.paidOut} className="text-2xl font-bold text-slate-900 dark:text-white mt-1" />
          </div>
          <div className="p-3 bg-rose-50 dark:bg-rose-950 text-rose-600 rounded-xl">
            <HeartHandshake className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">{t('fundBalance')}</span>
            <MoneyDisplay amount={summary.balance} highlight className="text-2xl font-bold mt-1" />
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded-xl">
            <Lock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">{t('activeMembers')}</span>
            <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 block">{summary.activeMembersCount}</span>
          </div>
          <div className="p-3 bg-sky-50 dark:bg-sky-950 text-sky-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Grid for Recent Payments & Recent Death Cases */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Payments */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Recent Payments</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/payments')}>View All</Button>
          </div>
          <div className="space-y-3">
            {recentPayments.map((p) => (
              <div key={p.id} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">{p.member_name}</span>
                  <span className="text-slate-400">Received by {p.received_by}</span>
                </div>
                <div className="text-right">
                  <MoneyDisplay amount={p.amount} negative={p.type === 'reversal'} className="font-bold text-sm block" />
                  <DateDisplay date={p.payment_date} className="text-slate-400 text-[10px]" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Death Support Cases */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Death Support Cases</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/death-support')}>View All</Button>
          </div>
          <div className="space-y-3">
            {recentCases.map((c) => (
              <div key={c.id} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{c.deceased_name}</span>
                    <span className="text-[10px] font-mono text-slate-400">({c.ref})</span>
                  </div>
                  <span className="text-slate-400">Member: {c.member_name} · Relation: {c.relation}</span>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold block mb-1 ${
                    c.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {c.status.toUpperCase()}
                  </span>
                  <MoneyDisplay amount={c.amount} className="font-bold text-sm" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
