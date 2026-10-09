/**
 * Date formatting and validation helper functions
 */

/**
 * Parses YYYY-MM-DD string into numeric { year, month, day } without UTC timezone shifts
 */
export function parseDateParts(dateInput) {
  if (!dateInput) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
  }
  if (typeof dateInput === 'string') {
    const cleanStr = dateInput.split('T')[0];
    const parts = cleanStr.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        return { year, month, day };
      }
    }
  }
  const d = new Date(dateInput);
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

/**
 * Formats YYYY-MM-DD or ISO date string into '10 Oct 2026'
 */
export function formatDate(dateInput) {
  if (!dateInput) return '—';
  const { year, month, day } = parseDateParts(dateInput);

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const monthLabel = months[month - 1] || 'Jan';

  return `${day} ${monthLabel} ${year}`;
}

/**
 * Gets today's local date string in YYYY-MM-DD format
 */
export function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * BR-11: Validates payment date is not in the future and not before join date
 */
export function validatePaymentDate(paymentDateStr, joinDateStr) {
  if (!paymentDateStr) {
    return { valid: false, code: 'DATE_INVALID', message: 'Payment date is required.' };
  }

  const todayStr = getTodayDateString();

  if (paymentDateStr > todayStr) {
    return { valid: false, code: 'DATE_INVALID', message: 'Payment date cannot be in the future.' };
  }

  if (joinDateStr && paymentDateStr < joinDateStr) {
    return {
      valid: false,
      code: 'DATE_INVALID',
      message: `Payment date cannot be before member join date (${formatDate(joinDateStr)}).`,
    };
  }

  return { valid: true };
}
