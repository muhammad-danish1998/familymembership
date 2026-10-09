import React from 'react';
import { Inbox } from 'lucide-react';
import { Button } from './Button.jsx';

export function EmptyState({
  icon: Icon = Inbox,
  title = 'No records found',
  description = 'There are no items to display at the moment.',
  actionLabel,
  onAction,
}) {
  const IconElement = Icon;
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 my-4">
      <div className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-xs mb-3 text-slate-400">
        <IconElement className="w-8 h-8" />
      </div>
      <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">{title}</h4>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-4 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
