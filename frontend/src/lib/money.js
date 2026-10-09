import {
  ANNUAL_CONTRIBUTION,
  DEATH_SUPPORT_AMOUNT,
  DEFAULT_MAX_DEFICIT,
} from '../constants/index.js';
import { parseDateParts } from './dates.js';

/**
 * Calculates member financial summary (BR-3 to BR-7)
 *
 * @param {Object} member Member object { join_date, opening_balance, status }
 * @param {Array} payments Member's payment rows [{ amount, type }]
 * @param {Object} options Options { currentYear, currentMonth, annualContribution }
 */
export function calculateMemberSummary(member, payments = [], options = {}) {
  const currentYear = options.currentYear ?? new Date().getFullYear();
  const currentMonth = options.currentMonth ?? new Date().getMonth() + 1; // 1-12
  const annual = options.annualContribution ?? ANNUAL_CONTRIBUTION;

  const { year: joinYear, month: joinMonth } = parseDateParts(member.join_date);
  const openingBalance = Number(member.opening_balance || 0);

  // BR-3: Dues calculation
  const yearsDue = Math.max(1, currentYear - joinYear + 1);
  const totalDue = yearsDue * annual + openingBalance;

  // BR-4: Sum of payments (reversals are negative)
  const paid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const remaining = Math.max(0, totalDue - paid);
  const advance = Math.max(0, paid - totalDue);

  // BR-5: Status check
  const isFullyPaid = remaining === 0;

  // BR-6: Expected so far & Behind calculation (Active members only)
  let expectedSoFar = 0;
  let behindBy = 0;

  if (member.status === 'active') {
    let base = 0;
    if (joinYear < currentYear) {
      const pastYearsCount = currentYear - joinYear;
      const monthlyRate = annual / 12;
      base = pastYearsCount * annual + Math.round(monthlyRate * currentMonth);
    } else {
      // Joined in current year
      const jm = joinMonth;
      const monthsActive = Math.max(1, currentMonth - jm + 1);
      const remainingMonths = 13 - jm;
      const monthlyRate = annual / remainingMonths;
      base = Math.min(annual, Math.round(monthlyRate * monthsActive));
    }
    expectedSoFar = openingBalance + base;
    behindBy = Math.max(0, expectedSoFar - paid);
  }

  // BR-10: Maximum payment cap (at most 1 year ahead)
  const maxPaymentAllowed = Math.max(0, totalDue + annual - paid);

  return {
    joinYear,
    yearsDue,
    openingBalance,
    totalDue,
    paid,
    remaining,
    advance,
    isFullyPaid,
    expectedSoFar,
    behindBy,
    isBehind: behindBy > 0,
    maxPaymentAllowed,
  };
}

/**
 * BR-7: Generates Year-by-Year breakdown of payments
 */
export function calculateYearView(member, payments = [], options = {}) {
  const currentYear = options.currentYear ?? new Date().getFullYear();
  const annual = options.annualContribution ?? ANNUAL_CONTRIBUTION;
  const { year: joinYear } = parseDateParts(member.join_date);
  const openingBalance = Number(member.opening_balance || 0);

  let totalPaidAvailable = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const years = [];

  // Handle opening balance bucket if present
  if (openingBalance > 0) {
    const paidToOpening = Math.min(openingBalance, totalPaidAvailable);
    totalPaidAvailable -= paidToOpening;
    years.push({
      yearLabel: 'Opening Dues',
      due: openingBalance,
      paid: paidToOpening,
      remaining: Math.max(0, openingBalance - paidToOpening),
      status: paidToOpening >= openingBalance ? 'Paid' : 'Partial',
    });
  }

  for (let year = joinYear; year <= currentYear; year++) {
    const paidForYear = Math.min(annual, totalPaidAvailable);
    totalPaidAvailable -= paidForYear;
    years.push({
      year,
      yearLabel: `${year}`,
      due: annual,
      paid: paidForYear,
      remaining: Math.max(0, annual - paidForYear),
      status: paidForYear >= annual ? 'Paid' : paidForYear > 0 ? 'Partial' : 'Unpaid',
    });
  }

  return {
    years,
    advanceForNextYear: Math.max(0, totalPaidAvailable),
  };
}

/**
 * BR-24: Fund summary calculations
 */
export function calculateFundSummary(payments = [], cases = [], members = [], settings = {}) {
  const deathSupport = settings.death_support ?? DEATH_SUPPORT_AMOUNT;
  const maxDeficit = settings.max_deficit ?? DEFAULT_MAX_DEFICIT;

  // BR-24: collected = sum of all payment rows
  const collected = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  // BR-20: paid_out = sum of verified/paid cases
  const paidCases = cases.filter((c) => c.status === 'paid');
  const paidOut = paidCases.reduce((sum, c) => sum + Number(c.amount || deathSupport), 0);

  const balance = collected - paidOut;

  const activeMembers = members.filter((m) => m.status === 'active');
  const activeMembersCount = activeMembers.length;

  let stillToCollect = 0;
  let fullyPaidCount = 0;
  let behindCount = 0;

  activeMembers.forEach((m) => {
    const mPayments = payments.filter((p) => p.member_id === m.id);
    const summary = calculateMemberSummary(m, mPayments, {
      annualContribution: settings.annual_contribution,
    });
    stillToCollect += summary.remaining;
    if (summary.isFullyPaid) fullyPaidCount++;
    if (summary.isBehind) behindCount++;
  });

  // BR-27: Shortfall calculation when balance < 0
  const shortfall = Math.max(0, -balance);
  const perMemberShare = activeMembersCount > 0 ? Math.ceil(shortfall / activeMembersCount) : 0;

  // BR-28: Low balance warning when balance < deathSupport
  const isLowBalance = balance >= 0 && balance < deathSupport;
  const isShortfall = balance < 0;

  return {
    collected,
    paidOut,
    balance,
    activeMembersCount,
    stillToCollect,
    paidCasesCount: paidCases.length,
    fullyPaidCount,
    behindCount,
    shortfall,
    perMemberShare,
    isLowBalance,
    isShortfall,
    maxDeficit,
  };
}

/**
 * BR-9: Validates payment amount
 */
export function validatePaymentAmount(amount, maxAllowed) {
  if (amount === undefined || amount === null || amount === '') {
    return { valid: false, code: 'AMOUNT_INVALID', message: 'Amount is required.' };
  }
  const num = Number(amount);
  if (!Number.isInteger(num) || num <= 0) {
    return { valid: false, code: 'AMOUNT_INVALID', message: 'Amount must be a whole positive number.' };
  }
  if (maxAllowed !== undefined && num > maxAllowed) {
    return {
      valid: false,
      code: 'AMOUNT_EXCEEDS_MAX',
      message: `Amount exceeds maximum allowed payment of Rs. ${maxAllowed.toLocaleString('en-PK')}.`,
    };
  }
  return { valid: true };
}

/**
 * BR-25/26: Validates death support release against negative balance limits
 */
export function validateDeathRelease(currentBalance, payoutAmount, reason, maxDeficit = DEFAULT_MAX_DEFICIT) {
  const balanceAfter = currentBalance - payoutAmount;

  // BR-26: Blocked if balance_after < -max_deficit
  if (balanceAfter < -maxDeficit) {
    return {
      allowed: false,
      code: 'DEFICIT_LIMIT',
      message: `Release blocked: deficit would be Rs. ${Math.abs(balanceAfter).toLocaleString('en-PK')}, exceeding max allowed deficit of Rs. ${maxDeficit.toLocaleString('en-PK')}.`,
    };
  }

  // BR-25: Requires reason if balance_after < 0
  if (balanceAfter < 0 && (!reason || reason.trim().length === 0)) {
    return {
      allowed: false,
      code: 'REASON_REQUIRED',
      message: 'A written reason is required when releasing a payment that results in a negative fund balance.',
    };
  }

  return { allowed: true, balanceAfter, requiresReason: balanceAfter < 0 };
}
