-- Seed data for Family Fund System (Fictional Demo Data)

-- 1. Initial Settings
INSERT INTO public.settings (id, annual_contribution, death_support, max_deficit)
VALUES (1, 6000, 70000, 70000)
ON CONFLICT (id) DO UPDATE
SET annual_contribution = EXCLUDED.annual_contribution,
    death_support = EXCLUDED.death_support,
    max_deficit = EXCLUDED.max_deficit;

-- 2. Initial Family PIN (123456)
INSERT INTO public.family_access (id, pin_hash, pin_version)
VALUES (1, crypt('123456', gen_salt('bf')), 1)
ON CONFLICT (id) DO NOTHING;

-- 3. Fictional Executives
INSERT INTO public.executives (id, name, active) VALUES
    ('e1111111-1111-1111-1111-111111111111', 'Tariq Mahmood', true),
    ('e2222222-2222-2222-2222-222222222222', 'Usman Ghani', true)
ON CONFLICT (name) DO NOTHING;

-- 4. Fictional Members
INSERT INTO public.members (id, name, father_name, mobile, cnic, address, join_date, status, opening_balance) VALUES
    ('m1111111-1111-1111-1111-111111111111', 'Muhammad Ali', 'Tariq Ali', '03001234567', '35202-1234567-1', 'House 12, Block A, Model Town, Lahore', '2024-01-01', 'active', 0),
    ('m2222222-2222-2222-2222-222222222222', 'Usman Khan', 'Bilal Khan', '03219876543', '35202-7654321-2', 'Street 5, Gulberg, Lahore', '2025-01-01', 'active', 0),
    ('m3333333-3333-3333-3333-333333333333', 'Zubair Hassan', 'Hassan Ahmed', '03335554433', '35202-5554433-3', 'Main Bazaar, Multan', '2024-06-01', 'active', 0),
    ('m4444444-4444-4444-4444-444444444444', 'Rashid Minhas', 'Minhas Khan', '03014445566', '35202-4445566-4', 'Sector G-9, Islamabad', '2023-01-01', 'deceased', 0)
ON CONFLICT (id) DO NOTHING;

-- 5. Member Coverage
INSERT INTO public.member_coverage (member_id, sons, daughters, wife, father, mother, brothers, sisters) VALUES
    ('m1111111-1111-1111-1111-111111111111', 2, 1, 1, 1, 1, 0, 0),
    ('m2222222-2222-2222-2222-222222222222', 1, 0, 1, 0, 1, 1, 2),
    ('m3333333-3333-3333-3333-333333333333', 0, 2, 1, 1, 0, 0, 1),
    ('m4444444-4444-4444-4444-444444444444', 3, 2, 1, 0, 0, 2, 1)
ON CONFLICT (member_id) DO NOTHING;

-- 6. Fictional Payments
INSERT INTO public.payments (id, member_id, amount, type, payment_date, executive_id, note) VALUES
    ('p1111111-1111-1111-1111-111111111111', 'm1111111-1111-1111-1111-111111111111', 6000, 'payment', '2024-03-15', 'e1111111-1111-1111-1111-111111111111', 'Annual payment 2024'),
    ('p2222222-2222-2222-2222-222222222222', 'm1111111-1111-1111-1111-111111111111', 6000, 'payment', '2025-02-10', NULL, 'Annual payment 2025'),
    ('p3333333-3333-3333-3333-333333333333', 'm1111111-1111-1111-1111-111111111111', 6000, 'payment', '2026-01-15', NULL, 'Annual payment 2026'),
    ('p4444444-4444-4444-4444-444444444444', 'm2222222-2222-2222-2222-222222222222', 6000, 'payment', '2025-05-20', 'e2222222-2222-2222-2222-222222222222', 'Annual payment 2025'),
    ('p5555555-5555-5555-5555-555555555555', 'm3333333-3333-3333-3333-333333333333', 3000, 'payment', '2026-04-01', NULL, 'Installment payment 2026')
ON CONFLICT (id) DO NOTHING;

-- 7. Audit Log Seed
INSERT INTO public.audit_log (actor, action, detail) VALUES
    ('System', 'system_initialized', '{"message": "Database seeded with initial structure"}'::jsonb);
