import React from 'react';
import { Loader2 } from 'lucide-react';

export function LoadingSpinner({ text = 'Loading data...', fullPage = false }) {
  const content = (
    <div className="flex flex-col items-center justify-center p-8 gap-3 text-slate-500 dark:text-slate-400">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      <span className="text-sm font-medium">{text}</span>
    </div>
  );

  if (fullPage) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
}
