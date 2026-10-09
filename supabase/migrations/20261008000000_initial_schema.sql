-- Migration: 20261008000000_initial_schema.sql
-- Description: Core tables and constraints for Family Fund System

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Settings (single row)
CREATE TABLE IF NOT EXISTS public.settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    annual_contribution INTEGER NOT NULL CHECK (annual_contribution > 0),
    death_support INTEGER NOT NULL CHECK (death_support > 0),
    max_deficit INTEGER NOT NULL CHECK (max_deficit >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admins table
CREATE TABLE IF NOT EXISTS public.admins (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Family access table (PIN hash + version)
CREATE TABLE IF NOT EXISTS public.family_access (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    pin_hash TEXT NOT NULL,
    pin_version INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PIN attempts log for rate-limiting
CREATE TABLE IF NOT EXISTS public.pin_attempts (
    id BIGSERIAL PRIMARY KEY,
    ip_hash TEXT NOT NULL,
    failed_count INTEGER NOT NULL DEFAULT 1,
    locked_until TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pin_attempts_ip_hash ON public.pin_attempts(ip_hash);

-- Executive collectors
CREATE TABLE IF NOT EXISTS public.executives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Members table
CREATE TABLE IF NOT EXISTS public.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    father_name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    cnic TEXT,
    address TEXT,
    join_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deceased')),
    opening_balance INTEGER NOT NULL DEFAULT 0 CHECK (opening_balance >= 0),
    continues_from UUID REFERENCES public.members(id) ON DELETE SET NULL,
    continued_by UUID REFERENCES public.members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_members_mobile ON public.members(mobile);
CREATE INDEX IF NOT EXISTS idx_members_name ON public.members(name);
CREATE INDEX IF NOT EXISTS idx_members_status ON public.members(status);

-- Member coverage table
CREATE TABLE IF NOT EXISTS public.member_coverage (
    member_id UUID PRIMARY KEY REFERENCES public.members(id) ON DELETE CASCADE,
    sons INTEGER NOT NULL DEFAULT 0 CHECK (sons BETWEEN 0 AND 20),
    daughters INTEGER NOT NULL DEFAULT 0 CHECK (daughters BETWEEN 0 AND 20),
    wife INTEGER NOT NULL DEFAULT 0 CHECK (wife BETWEEN 0 AND 20),
    father INTEGER NOT NULL DEFAULT 0 CHECK (father BETWEEN 0 AND 20),
    mother INTEGER NOT NULL DEFAULT 0 CHECK (mother BETWEEN 0 AND 20),
    brothers INTEGER NOT NULL DEFAULT 0 CHECK (brothers BETWEEN 0 AND 20),
    sisters INTEGER NOT NULL DEFAULT 0 CHECK (sisters BETWEEN 0 AND 20),
    other_dependents INTEGER NOT NULL DEFAULT 0 CHECK (other_dependents BETWEEN 0 AND 20),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payments table
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
    amount INTEGER NOT NULL CHECK (amount != 0),
    type TEXT NOT NULL CHECK (type IN ('payment', 'reversal')),
    reverses UUID UNIQUE REFERENCES public.payments(id) ON DELETE RESTRICT,
    payment_date DATE NOT NULL,
    executive_id UUID REFERENCES public.executives(id) ON DELETE SET NULL,
    note TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_member_id ON public.payments(member_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON public.payments(payment_date);

-- Death cases table
CREATE TABLE IF NOT EXISTS public.death_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
    ref TEXT NOT NULL UNIQUE,
    deceased_name TEXT NOT NULL,
    relation TEXT NOT NULL,
    death_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'verified', 'paid')),
    amount INTEGER NOT NULL CHECK (amount > 0),
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    paid_at TIMESTAMPTZ,
    paid_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    deficit_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BR-22 Partial unique index: prevent duplicate registered/verified/paid cases for same member + relation + deceased_name (case insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_death_case ON public.death_cases(member_id, LOWER(relation), LOWER(deceased_name));

-- Audit log table (append-only)
CREATE TABLE IF NOT EXISTS public.audit_log (
    id BIGSERIAL PRIMARY KEY,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    detail JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);
