import { describe, expect, it } from 'vitest';
import { cases, family, members, payments, executives } from '../services/mock/index.js';

describe('Phase A Mock Service Adapter Tests', () => {
  it('Family PIN login succeeds with correct PIN (123456)', async () => {
    const res = await family.login('123456');
    expect(res.token).toContain('mock-family-token');
  });

  it('Family PIN login fails with wrong PIN and locks out after 5 failures', async () => {
    // 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await expect(family.login('000000')).rejects.toMatchObject({ code: 'WRONG_PIN' });
    }
    // 6th attempt is locked
    await expect(family.login('000000')).rejects.toMatchObject({ code: 'LOCKED' });
  });

  it('Members list returns seeded members', async () => {
    const res = await members.list();
    expect(res.total).toBeGreaterThan(0);
    expect(res.items[0]).toHaveProperty('name');
    expect(res.items[0]).toHaveProperty('summary');
  });

  it('Payment addition & reversal workflow (BR-8 & BR-12)', async () => {
    // Add payment
    const newPay = await payments.add({
      memberId: 'mem-1',
      amount: 1000,
      date: new Date().toISOString().split('T')[0],
      note: 'Test payment',
    });
    expect(newPay.amount).toBe(1000);

    // Reverse payment
    const rev = await payments.reverse(newPay.id, 'Test reversal reason');
    expect(rev.amount).toBe(-1000);
    expect(rev.reverses).toBe(newPay.id);

    // Cannot reverse twice
    await expect(payments.reverse(newPay.id, 'Second try')).rejects.toMatchObject({
      code: 'ALREADY_REVERSED',
    });
  });

  it('Death case workflow & duplicate prevention (BR-22)', async () => {
    const newCase = await cases.register({
      member_id: 'mem-1',
      deceased_name: 'Test Deceased Person',
      relation: 'father',
      death_date: '2026-02-01',
      notes: 'Initial registration',
    });
    expect(newCase.ref).toMatch(/^DS-\d+/);

    // Duplicate prevention
    await expect(
      cases.register({
        member_id: 'mem-1',
        deceased_name: 'Test Deceased Person',
        relation: 'father',
        death_date: '2026-02-01',
      })
    ).rejects.toMatchObject({ code: 'DUPLICATE_CASE' });
  });

  it('Self death registration updates member status to deceased automatically (BR-23)', async () => {
    await cases.register({
      member_id: 'mem-2',
      deceased_name: 'Tariq Mehmood',
      relation: 'self',
      death_date: '2026-02-01',
    });
    const updatedMember = await members.get('mem-2');
    expect(updatedMember.status).toBe('deceased');
  });

  it('Executive portal PIN set, login, member submission & admin approval workflow', async () => {
    await executives.setPin('exec-1', '5555');

    // Verify executive PIN is visible in admin list
    const execList = await executives.list();
    const exec1 = execList.find((e) => e.id === 'exec-1');
    expect(exec1.pin).toBe('5555');

    // 2. Executive login with correct PIN
    const loginRes = await executives.login('exec-1', '5555');
    expect(loginRes.token).toContain('exec-token-exec-1');

    // 3. Executive submit member
    const submitted = await executives.submitMember('exec-1', '5555', {
      name: 'Executive Test Member',
      father_name: 'Exec Father',
      mobile: '03009998877',
      join_date: '2026-01-01',
      opening_balance: 500,
    });
    expect(submitted.approval_status).toBe('pending');

    // 4. Admin list pending
    const pendingList = await members.listPending();
    const foundPending = pendingList.find((p) => p.id === submitted.id);
    expect(foundPending).toBeDefined();

    // 5. Admin approve submission
    const approved = await members.approveSubmission(submitted.id);
    expect(approved.approval_status).toBe('approved');
    expect(approved.status).toBe('active');

    // 6. Admin remove executive
    const newExec = await executives.add('Temp Exec');
    await executives.remove(newExec.id);
    const updatedList = await executives.list();
    expect(updatedList.find((e) => e.id === newExec.id)).toBeUndefined();
  });
});
