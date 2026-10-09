import React from 'react';
import { formatDate } from '../../lib/dates.js';

export function DateDisplay({ date, className = '' }) {
  return (
    <span dir="ltr" className={`inline-block ${className}`}>
      {formatDate(date)}
    </span>
  );
}
