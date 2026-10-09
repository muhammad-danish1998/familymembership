import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../../hooks/useI18n.js';
import { auth, isMockMode } from '../../services/index.js';
import { Button } from '../common/Button.jsx';
import { Globe, Shield, ShieldCheck, LogOut, Users, HeartHandshake, LayoutDashboard, CreditCard, Settings, UserX } from 'lucide-react';

export function Header() {
  const { t, toggleLanguage, lang } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);

  const isAdminArea = location.pathname.startsWith('/admin');

  useEffect(() => {
    let active = true;
    auth.getSession().then((sess) => {
      if (active) setSession(sess);
    });
    return () => {
      active = false;
    };
  }, [location.pathname]);

  const handleLogout = async () => {
    await auth.signOut();
    setSession(null);
    navigate('/admin/login');
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      {/* Demo Mode Banner (AGENTS.md §5.6) */}
      {isMockMode && (
        <div className="bg-amber-500 text-amber-950 text-xs font-semibold px-4 py-1 text-center flex items-center justify-center gap-2 shadow-xs">
          <span>⚠️ {t('demoMode')} — Data is saved locally in browser. PIN & passwords are fake demo credentials.</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand / Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-md group-hover:bg-emerald-700 transition-colors">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white block">
                {t('appTitle')}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 block -mt-1">
                {t('tagline')}
              </span>
            </div>
          </Link>

          {/* Nav Links for Admin */}
          {isAdminArea && session && (
            <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
              <Link
                to="/admin/dashboard"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
                  location.pathname === '/admin/dashboard'
                    ? 'bg-slate-100 dark:bg-slate-800 text-emerald-600 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                {t('navDashboard')}
              </Link>
              <Link
                to="/admin/members"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
                  location.pathname.startsWith('/admin/members')
                    ? 'bg-slate-100 dark:bg-slate-800 text-emerald-600 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                {t('navMembers')}
              </Link>
              <Link
                to="/admin/payments"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
                  location.pathname.startsWith('/admin/payments')
                    ? 'bg-slate-100 dark:bg-slate-800 text-emerald-600 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                {t('navPayments')}
              </Link>
              <Link
                to="/admin/death-support"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
                  location.pathname.startsWith('/admin/death-support')
                    ? 'bg-slate-100 dark:bg-slate-800 text-emerald-600 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                <UserX className="w-4 h-4" />
                {t('navDeathSupport')}
              </Link>
              <Link
                to="/admin/settings"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
                  location.pathname.startsWith('/admin/settings')
                    ? 'bg-slate-100 dark:bg-slate-800 text-emerald-600 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                <Settings className="w-4 h-4" />
                {t('navSettings')}
              </Link>
            </nav>
          )}

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            {/* Read-Only Badge on Family Pages */}
            {!isAdminArea && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-full border border-emerald-200 dark:border-emerald-800">
                <ShieldCheck className="w-3.5 h-3.5" />
                {t('readOnly')}
              </span>
            )}

            {/* Language Switcher */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleLanguage}
              className="font-bold gap-1.5"
              title="Switch Language / زبان تبدیل کریں"
            >
              <Globe className="w-4 h-4 text-emerald-600" />
              <span>{lang === 'en' ? 'اردو' : 'English'}</span>
            </Button>

            {/* Admin Login / Logout button */}
            {session ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">{t('navLogout')}</span>
              </Button>
            ) : (
              !isAdminArea && (
                <Link to="/admin/login">
                  <Button variant="ghost" size="sm">
                    <Shield className="w-4 h-4 text-slate-500" />
                    <span className="hidden sm:inline">{t('navAdminLogin')}</span>
                  </Button>
                </Link>
              )
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
