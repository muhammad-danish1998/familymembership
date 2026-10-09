import React from 'react';
import { formatMoney } from '../../lib/format.js';

export function MoneyDisplay({ amount, className = '', negative = false, highlight = false }) {
  const isNegative = negative || Number(amount || 0) < 0;
  const absAmount = Math.abs(Number(amount || 0));

  let styleClasses = className;
  if (highlight) {
    styleClasses += isNegative
      ? ' text-rose-600 dark:text-rose-400 font-semibold'
      : ' text-emerald-600 dark:text-emerald-400 font-semibold';
  }

  return (
    <span dir="ltr" className={`inline-block font-mono ${styleClasses}`}>
      {isNegative ? `- ${formatMoney(absAmount)}` : formatMoney(absAmount)}
    </span>
  );
}
