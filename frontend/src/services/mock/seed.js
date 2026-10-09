/**
 * Initial Fictional Seed Data for Phase A Mock Adapter
 */
export const INITIAL_SEED = {
  settings: {
    annual_contribution: 6000,
    death_support: 70000,
    max_deficit: 70000,
  },

  familyAccess: {
    pin: '123456',
    pinVersion: 1,
    failedAttempts: 0,
    lockedUntil: null,
  },

  adminAuth: {
    email: 'admin@example.test',
    password: 'admin123',
  },

  executives: [
    { id: 'exec-1', name: 'Chaudhry Tariq', active: true },
    { id: 'exec-2', name: 'Malik Zahid', active: true },
  ],

  members: [
    {
      id: 'mem-1',
      name: 'Muhammad Aslam',
      father_name: 'Abdul Rehman',
      mobile: '03001234567',
      cnic: '35202-1234567-1',
      address: 'House 14, Main St, Village',
      join_date: '2024-01-01',
      opening_balance: 0,
      status: 'active',
      continues_from: null,
      continued_by: null,
      coverage: { sons: 2, daughters: 1, wife: 1, father: 0, mother: 1, brothers: 0, sisters: 0, other: 0 },
    },
    {
      id: 'mem-2',
      name: 'Tariq Mehmood',
      father_name: 'Muhammad Din',
      mobile: '03019876543',
      cnic: '35202-7654321-3',
      address: 'Patti West, House 8',
      join_date: '2024-01-01',
      opening_balance: 0,
      status: 'active',
      continues_from: null,
      continued_by: null,
      coverage: { sons: 1, daughters: 2, wife: 1, father: 1, mother: 1, brothers: 2, sisters: 1, other: 0 },
    },
  ],

  payments: [
    {
      id: 'pay-1',
      member_id: 'mem-1',
      amount: 6000,
      type: 'payment',
      reverses: null,
      payment_date: '2024-02-10',
      executive_id: null,
      note: 'Full 2024 payment',
      created_by: 'Admin',
      created_at: '2024-02-10T10:00:00Z',
    },
  ],

  deathCases: [],

  auditLog: [
    {
      id: 'audit-1',
      actor: 'Admin',
      action: 'SYSTEM_INITIALIZED',
      detail: 'System seed data loaded.',
      created_at: '2026-01-01T00:00:00Z',
    },
  ],
};
