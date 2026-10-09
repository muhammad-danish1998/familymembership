import { describe, expect, it } from 'vitest';
import {
  calculateFundSummary,
  calculateMemberSummary,
  calculateYearView,
  validateDeathRelease,
  validatePaymentAmount,
} from '../lib/money.js';

describe('BR-3 to BR-7 Member Calculations', () => {
  it('BR-6 Fixture 1: Joined March last year, paid 4,000 (Current = October)', () => {
    const member = {
      join_date: '2025-03-15',
      opening_balance: 0,
      status: 'active',
    };
    const payments = [{ amount: 4000, type: 'payment' }];
    const options = { currentYear: 2026, currentMonth: 10, annualContribution: 6000 };

    const summary = calculateMemberSummary(member, payments, options);

    expect(summary.totalDue).toBe(12000);
    expect(summary.paid).toBe(4000);
    expect(summary.remaining).toBe(8000);
    expect(summary.expectedSoFar).toBe(11000);
    expect(summary.behindBy).toBe(7000);
  });

  it('BR-6 Fixture 2: Joined July this year, paid 4,000 (Current = October)', () => {
    const member = {
      join_date: '2026-07-01',
      opening_balance: 0,
      status: 'active',
    };
    const payments = [{ amount: 4000, type: 'payment' }];
    const options = { currentYear: 2026, currentMonth: 10, annualContribution: 6000 };

    const summary = calculateMemberSummary(member, payments, options);

    expect(summary.totalDue).toBe(6000);
    expect(summary.paid).toBe(4000);
    expect(summary.remaining).toBe(2000);
    expect(summary.expectedSoFar).toBe(4000);
    expect(summary.behindBy).toBe(0);
  });

  it('BR-6 Fixture 3: Joined October this year, paid 0 (Current = October)', () => {
    const member = {
      join_date: '2026-10-01',
      opening_balance: 0,
      status: 'active',
    };
    const payments = [];
    const options = { currentYear: 2026, currentMonth: 10, annualContribution: 6000 };

    const summary = calculateMemberSummary(member, payments, options);

    expect(summary.totalDue).toBe(6000);
    expect(summary.paid).toBe(0);
    expect(summary.remaining).toBe(6000);
    expect(summary.expectedSoFar).toBe(2000);
    expect(summary.behindBy).toBe(2000);
  });

  it('BR-7: Year view breaks down dues and applies payments oldest first', () => {
    const member = { join_date: '2024-01-01', opening_balance: 0, status: 'active' };
    const payments = [{ amount: 15000, type: 'payment' }];
    const options = { currentYear: 2026, annualContribution: 6000 };

    const yearView = calculateYearView(member, payments, options);
    expect(yearView.years).toHaveLength(3); // 2024, 2025, 2026
    expect(yearView.years[0].paid).toBe(6000);
    expect(yearView.years[1].paid).toBe(6000);
    expect(yearView.years[2].paid).toBe(3000);
    expect(yearView.advanceForNextYear).toBe(0);
  });

  it('Carried-over dues (opening_balance) are counted as behind immediately', () => {
    const member = {
      join_date: '2026-01-01',
      opening_balance: 3000,
      status: 'active',
    };
    const payments = [];
    const options = { currentYear: 2026, currentMonth: 1, annualContribution: 6000 };

    const summary = calculateMemberSummary(member, payments, options);

    expect(summary.openingBalance).toBe(3000);
    expect(summary.expectedSoFar).toBe(3500); // 3000 opening + 500 Jan guide
    expect(summary.behindBy).toBe(3500);
  });

  it('BR-10: 14,000 paid on 12,000 total due gives max additional payment of 4,000', () => {
    const member = {
      join_date: '2025-01-01',
      opening_balance: 0,
      status: 'active',
    };
    const payments = [{ amount: 14000, type: 'payment' }];
    const options = { currentYear: 2026, currentMonth: 10, annualContribution: 6000 };

    const summary = calculateMemberSummary(member, payments, options);

    expect(summary.totalDue).toBe(12000);
    expect(summary.paid).toBe(14000);
    expect(summary.advance).toBe(2000);
    expect(summary.maxPaymentAllowed).toBe(4000);
  });

  it('BR-12: Reversal nets total payment to zero', () => {
    const member = { join_date: '2026-01-01', opening_balance: 0, status: 'active' };
    const payments = [
      { id: 1, amount: 6000, type: 'payment' },
      { id: 2, amount: -6000, type: 'reversal', reverses: 1 },
    ];
    const summary = calculateMemberSummary(member, payments);
    expect(summary.paid).toBe(0);
    expect(summary.remaining).toBe(6000);
  });
});

describe('BR-9 Payment Validation', () => {
  it('accepts valid whole positive amounts', () => {
    expect(validatePaymentAmount(6000).valid).toBe(true);
    expect(validatePaymentAmount(500).valid).toBe(true);
  });

  it('rejects 0, negative numbers, decimals, and empty inputs', () => {
    expect(validatePaymentAmount(0).valid).toBe(false);
    expect(validatePaymentAmount(-1000).valid).toBe(false);
    expect(validatePaymentAmount(1.5).valid).toBe(false);
    expect(validatePaymentAmount('').valid).toBe(false);
    expect(validatePaymentAmount(null).valid).toBe(false);
  });

  it('rejects amounts exceeding max allowed cap', () => {
    const res = validatePaymentAmount(5000, 4000);
    expect(res.valid).toBe(false);
    expect(res.code).toBe('AMOUNT_EXCEEDS_MAX');
  });
});

describe('BR-25 & BR-26 Deficit & Fund Payout Rules', () => {
  it('BR-25: allows payout creating deficit if reason is provided', () => {
    const res = validateDeathRelease(46000, 70000, 'Urgent support needed', 70000);
    expect(res.allowed).toBe(true);
    expect(res.balanceAfter).toBe(-24000);
  });

  it('BR-25: rejects payout creating deficit if reason is missing', () => {
    const res = validateDeathRelease(46000, 70000, '', 70000);
    expect(res.allowed).toBe(false);
    expect(res.code).toBe('REASON_REQUIRED');
  });

  it('BR-26: blocks payout if deficit exceeds max allowed deficit (70,000)', () => {
    const res = validateDeathRelease(-24000, 70000, 'Second death', 70000);
    expect(res.allowed).toBe(false);
    expect(res.code).toBe('DEFICIT_LIMIT');
  });

  it('BR-24 & BR-27: Fund summary calculates shortfall per active member correctly', () => {
    const payments = [{ amount: 46000 }];
    const cases = [{ amount: 70000, status: 'paid' }];
    const members = [
      { id: 1, status: 'active' },
      { id: 2, status: 'active' },
      { id: 3, status: 'active' },
    ];

    const summary = calculateFundSummary(payments, cases, members);

    expect(summary.balance).toBe(-24000);
    expect(summary.shortfall).toBe(24000);
    expect(summary.perMemberShare).toBe(8000);
  });
});
