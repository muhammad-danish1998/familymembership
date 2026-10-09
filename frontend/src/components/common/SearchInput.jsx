import React from 'react';
import { Search, X } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n.js';

export function SearchInput({ value, onChange, placeholder, className = '' }) {
  const { t } = useI18n();

  return (
    <div className={`relative flex items-center ${className}`}>
      <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none rtl:right-3 rtl:left-auto" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || t('search')}
        className="w-full pl-9 pr-9 rtl:pr-9 rtl:pl-9 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-3 rtl:left-3 rtl:right-auto p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
