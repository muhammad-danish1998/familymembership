import React, { useEffect, useState } from 'react';
import { useI18n } from '../../hooks/useI18n.js';
import { useToast } from '../../hooks/useToast.js';
import { settings, executives, auth, audit, exporter } from '../../services/index.js';
import { Button } from '../../components/common/Button.jsx';
import { ConfirmDialog } from '../../components/common/ConfirmDialog.jsx';
import { DateDisplay } from '../../components/common/DateDisplay.jsx';
import { MoneyDisplay } from '../../components/common/MoneyDisplay.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { KeyRound, Lock, UserCheck, Download, History, Plus, Trash2 } from 'lucide-react';

export function AdminSettings() {
  const { t } = useI18n();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('pin'); // 'pin', 'password', 'executives', 'export', 'audit'

  // PIN state
  const [newPin, setNewPin] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Executives state
  const [execList, setExecList] = useState([]);
  const [newExecName, setNewExecName] = useState('');
  const [execLoading, setExecLoading] = useState(false);

  // Audit Log state
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'executives') fetchExecutives();
    if (activeTab === 'audit') fetchAuditLog();
  }, [activeTab]);

  const fetchExecutives = async () => {
    setExecLoading(true);
    try {
      const res = await executives.list();
      setExecList(res);
    } catch (err) {
      toast.error(err.message || 'Failed to load executives.');
    } finally {
      setExecLoading(false);
    }
  };

  const fetchAuditLog = async () => {
    setAuditLoading(true);
    try {
      const res = await audit.list({ page: 1, pageSize: 50 });
      setAuditLogs(res.items);
    } catch (err) {
      toast.error(err.message || 'Failed to load audit logs.');
    } finally {
      setAuditLoading(false);
    }
  };

  const handlePinSubmit = async (e) => {
    e.preventDefault();
    setPinLoading(true);
    try {
      await settings.changeFamilyPin(newPin);
      toast.success('Family PIN changed! All previous sessions invalidated.');
      setNewPin('');
    } catch (err) {
      toast.error(err.message || 'Failed to change PIN.');
    } finally {
      setPinLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordLoading(true);
    try {
      await auth.changePassword(currentPassword, nextPassword);
      toast.success('Admin password updated successfully.');
      setCurrentPassword('');
      setNextPassword('');
    } catch (err) {
      toast.error(err.message || 'Failed to change password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleAddExec = async (e) => {
    e.preventDefault();
    if (!newExecName.trim()) return;
    try {
      await executives.add(newExecName.trim());
      toast.success('Executive added.');
      setNewExecName('');
      fetchExecutives();
    } catch (err) {
      toast.error(err.message || 'Failed to add executive.');
    }
  };

  const handleToggleExec = async (exec) => {
    try {
      await executives.setActive(exec.id, !exec.active);
      toast.success(`Executive ${exec.name} status updated.`);
      fetchExecutives();
    } catch (err) {
      toast.error(err.message || 'Failed to toggle executive.');
    }
  };

  const downloadFile = (content, filename, type = 'text/csv') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportMembers = async () => {
    const csv = await exporter.membersCsv();
    downloadFile(csv, `family-members-${Date.now()}.csv`);
    toast.success('Members CSV downloaded.');
  };

  const handleExportPayments = async () => {
    const csv = await exporter.paymentsCsv();
    downloadFile(csv, `family-payments-${Date.now()}.csv`);
    toast.success('Payments CSV downloaded.');
  };

  const handleExportBackup = async () => {
    const json = await exporter.backupJson();
    downloadFile(json, `family-fund-backup-${Date.now()}.json`, 'application/json');
    toast.success('Full system JSON backup downloaded.');
  };

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleRestoreJson = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        await exporter.restore(event.target.result);
        toast.success('Backup restored successfully! Refreshing...');
        setTimeout(() => window.location.reload(), 1000);
      } catch (err) {
        toast.error(err.message || 'Failed to restore backup.');
      }
    };
    reader.readAsText(file);
  };

  const handleClearData = async () => {
    try {
      if (settings.clearAllData) {
        await settings.clearAllData();
      } else {
        localStorage.removeItem('ff_mock_v1');
      }
      toast.success('All fund data cleared! Page will refresh...');
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      toast.error(err.message || 'Failed to clear data.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('navSettings')}</h1>
        <p className="text-xs text-slate-500">Security PIN, password, executive collectors, backups & audit logs</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        {[
          { id: 'pin', label: 'Family PIN', icon: KeyRound },
          { id: 'password', label: 'Admin Password', icon: Lock },
          { id: 'executives', label: 'Executive Collectors', icon: UserCheck },
          { id: 'export', label: 'Data Export & Backup', icon: Download },
          { id: 'audit', label: 'Audit Log', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        {activeTab === 'pin' && (
          <form onSubmit={handlePinSubmit} className="max-w-md space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Change Family Shared PIN</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Family members use this numeric PIN (6 to 8 digits) to view fund statements. Changing the PIN immediately invalidates all active family view sessions.
            </p>
            <div>
              <label className="block text-xs font-semibold mb-1">New Family PIN (6-8 numeric digits)</label>
              <input
                type="password"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="123456"
                maxLength={8}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800"
                required
              />
            </div>
            <Button type="submit" variant="primary" loading={pinLoading}>Update Family PIN</Button>
          </form>
        )}

        {activeTab === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="max-w-md space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Change Admin Password</h3>
            <div>
              <label className="block text-xs font-semibold mb-1">Current Admin Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">New Password (Min 8 chars, letter & number)</label>
              <input
                type="password"
                value={nextPassword}
                onChange={(e) => setNextPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800"
                required
              />
            </div>
            <Button type="submit" variant="primary" loading={passwordLoading}>Update Password</Button>
          </form>
        )}

        {activeTab === 'executives' && (
          <div className="space-y-6">
            <form onSubmit={handleAddExec} className="flex items-center gap-2 max-w-md">
              <input
                type="text"
                value={newExecName}
                onChange={(e) => setNewExecName(e.target.value)}
                placeholder="Executive Collector Name (e.g. Chaudhry Tariq)"
                className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800"
                required
              />
              <Button type="submit" variant="primary">
                <Plus className="w-4 h-4" /> Add Executive
              </Button>
            </form>

            {execLoading ? (
              <LoadingSpinner text="Loading executives..." />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-sm">
                {execList.map((e) => (
                  <div key={e.id} className="p-4 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">{e.name}</span>
                      <span className="text-xs text-slate-400">Total Collected Net: <MoneyDisplay amount={e.totalCollected} className="font-bold" /></span>
                    </div>
                    <Button
                      variant={e.active ? 'outline' : 'ghost'}
                      size="sm"
                      onClick={() => handleToggleExec(e)}
                    >
                      {e.active ? 'Active' : 'Inactive (Archived)'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'export' && (
          <div className="space-y-6 max-w-lg">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Data Export & Backup</h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="font-bold text-sm block">Export Members CSV</span>
                  <span className="text-xs text-slate-500">Download full directory with dues & payment status</span>
                </div>
                <Button variant="outline" size="sm" onClick={handleExportMembers}>
                  <Download className="w-4 h-4" /> Members CSV
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="font-bold text-sm block">Export Payments CSV</span>
                  <span className="text-xs text-slate-500">Download payment transaction history</span>
                </div>
                <Button variant="outline" size="sm" onClick={handleExportPayments}>
                  <Download className="w-4 h-4" /> Payments CSV
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="font-bold text-sm block">Full System JSON Backup</span>
                  <span className="text-xs text-slate-500">Complete database snapshot (members, payments, settings)</span>
                </div>
                <Button variant="primary" size="sm" onClick={handleExportBackup}>
                  <Download className="w-4 h-4" /> Download JSON
                </Button>
              </div>

              <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-2">
                <span className="font-bold text-sm text-amber-900 dark:text-amber-200 block">Restore JSON Backup (Demo Mode Only)</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestoreJson}
                  className="text-xs text-amber-900 dark:text-amber-200 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-600 file:text-white hover:file:bg-amber-700 cursor-pointer"
                />
              </div>

              <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm text-rose-900 dark:text-rose-200 block">Clear Sample Data (Start Fresh)</span>
                  <span className="text-xs text-rose-700 dark:text-rose-300">Wipe sample members & payments to begin entering your actual fund data</span>
                </div>
                <Button variant="danger" size="sm" onClick={() => setShowClearConfirm(true)}>
                  <Trash2 className="w-4 h-4" /> Clear All Data
                </Button>
              </div>
            </div>
          </div>
        )}

        <ConfirmDialog
          isOpen={showClearConfirm}
          onClose={() => setShowClearConfirm(false)}
          onConfirm={handleClearData}
          title="Clear All Sample Data?"
          message="Are you sure you want to clear all sample members, payments, and death cases? This will leave your system completely clean ready for your actual family fund entries."
          confirmText="Yes, Clear All Data"
          variant="danger"
        />

        {activeTab === 'audit' && (
          <div className="space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Append-Only Audit Log</h3>
            {auditLoading ? (
              <LoadingSpinner text="Loading audit log..." />
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left rtl:text-right">
                  <thead className="bg-slate-50 dark:bg-slate-800 font-semibold border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Actor</th>
                      <th className="p-3">Action</th>
                      <th className="p-3">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="p-3 font-mono text-slate-500"><DateDisplay date={log.created_at} /></td>
                        <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">{log.actor}</td>
                        <td className="p-3 font-mono text-emerald-600 dark:text-emerald-400">{log.action}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{log.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
