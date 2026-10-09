/**
 * Formatting utilities for Currency, Mobile numbers, and WhatsApp links (BR-14)
 */

/**
 * BR-4.9: Formats whole integer money amounts as 'Rs. 6,000'
 */
export function formatMoney(amount) {
  const num = Math.round(Number(amount || 0));
  const formatted = new Intl.NumberFormat('en-PK').format(num);
  return `Rs. ${formatted}`;
}

/**
 * BR-15: Validates mobile number requires between 10 and 13 digits
 */
export function validateMobile(mobileStr) {
  if (!mobileStr) return false;
  const digits = mobileStr.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 13;
}

/**
 * Formats Pakistani mobile number for display: '03001234567' -> '0300-1234567'
 */
export function formatMobile(mobileStr) {
  if (!mobileStr) return '';
  const digits = mobileStr.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('03')) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  return mobileStr;
}

/**
 * BR-14: Generates WhatsApp link converting 03xx to 923xx
 */
export function generateWhatsAppLink(mobileStr, textMessage = '') {
  if (!mobileStr) return '#';
  let digits = mobileStr.replace(/\D/g, '');

  if (digits.startsWith('03')) {
    digits = '92' + digits.slice(1);
  } else if (digits.startsWith('3') && digits.length === 10) {
    digits = '92' + digits;
  }

  const encodedText = encodeURIComponent(textMessage);
  return `https://wa.me/${digits}?text=${encodedText}`;
}

/**
 * Formats coverage breakdown string (BR-18): e.g. "2 Sons · 1 Daughter · 1 Wife"
 */
export function formatCoverageSummary(coverage = {}, labels = {}) {
  const parts = [];
  const defaultLabels = {
    sons: 'Son',
    daughters: 'Daughter',
    wife: 'Wife',
    father: 'Father',
    mother: 'Mother',
    brothers: 'Brother',
    sisters: 'Sister',
    other: 'Other',
  };

  const l = { ...defaultLabels, ...labels };

  if (coverage.sons > 0) parts.push(`${coverage.sons} ${coverage.sons > 1 ? 'Sons' : l.sons}`);
  if (coverage.daughters > 0) parts.push(`${coverage.daughters} ${coverage.daughters > 1 ? 'Daughters' : l.daughters}`);
  if (coverage.wife > 0) parts.push(`${coverage.wife} ${l.wife}`);
  if (coverage.father > 0) parts.push(`${coverage.father} ${l.father}`);
  if (coverage.mother > 0) parts.push(`${coverage.mother} ${l.mother}`);
  if (coverage.brothers > 0) parts.push(`${coverage.brothers} ${coverage.brothers > 1 ? 'Brothers' : l.brothers}`);
  if (coverage.sisters > 0) parts.push(`${coverage.sisters} ${coverage.sisters > 1 ? 'Sisters' : l.sisters}`);
  if (coverage.other > 0) parts.push(`${coverage.other} ${l.other}`);

  return parts.length > 0 ? parts.join(' · ') : 'Self only';
}
