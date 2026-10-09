export const PIN_MIN_LENGTH = 6;
export const PIN_MAX_LENGTH = 8;
export const ANNUAL_CONTRIBUTION = 6000;
export const DEATH_SUPPORT_AMOUNT = 70000;
export const DEFAULT_MAX_DEFICIT = 70000;

export const COVERAGE_KEYS = [
  'sons',
  'daughters',
  'wife',
  'father',
  'mother',
  'brothers',
  'sisters',
  'other',
];

export const RELATIONS = [
  'self',
  'wife',
  'son',
  'daughter',
  'father',
  'mother',
  'brother',
  'sister',
  'other',
];

export const ERROR_CODES = {
  NOT_AUTHORIZED: 'NOT_AUTHORIZED',
  VALIDATION: 'VALIDATION',
  DUPLICATE_MOBILE: 'DUPLICATE_MOBILE',
  AMOUNT_INVALID: 'AMOUNT_INVALID',
  AMOUNT_EXCEEDS_MAX: 'AMOUNT_EXCEEDS_MAX',
  DATE_INVALID: 'DATE_INVALID',
  ALREADY_REVERSED: 'ALREADY_REVERSED',
  DUPLICATE_CASE: 'DUPLICATE_CASE',
  REASON_REQUIRED: 'REASON_REQUIRED',
  DEFICIT_LIMIT: 'DEFICIT_LIMIT',
  WRONG_PIN: 'WRONG_PIN',
  LOCKED: 'LOCKED',
  NETWORK: 'NETWORK',
  UNKNOWN: 'UNKNOWN',
};
