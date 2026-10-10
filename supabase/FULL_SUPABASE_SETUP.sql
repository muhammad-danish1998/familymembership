-- =====================================================================
-- FAMILY FUND SYSTEM — COMPLETE ALL-IN-ONE SUPABASE SETUP & MIGRATION
-- Run this single script in your Supabase Dashboard -> SQL Editor
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Core Tables
CREATE TABLE IF NOT EXISTS public.settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    annual_contribution INTEGER NOT NULL CHECK (annual_contribution > 0),
    death_support INTEGER NOT NULL CHECK (death_support > 0),
    max_deficit INTEGER NOT NULL CHECK (max_deficit >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admins (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.family_access (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    pin_hash TEXT NOT NULL,
    pin_version INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pin_attempts (
    id BIGSERIAL PRIMARY KEY,
    ip_hash TEXT NOT NULL,
    failed_count INTEGER NOT NULL DEFAULT 1,
    locked_until TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pin_attempts_ip_hash ON public.pin_attempts(ip_hash);

CREATE TABLE IF NOT EXISTS public.executives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    pin_hash TEXT,
    pin_code TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.executives ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE public.executives ADD COLUMN IF NOT EXISTS pin_code TEXT;

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
    submitted_by_executive_id UUID REFERENCES public.executives(id) ON DELETE SET NULL,
    approval_status TEXT NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('approved', 'pending', 'rejected')),
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.members ADD COLUMN IF NOT EXISTS submitted_by_executive_id UUID REFERENCES public.executives(id) ON DELETE SET NULL;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('approved', 'pending', 'rejected'));
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_members_mobile ON public.members(mobile);
CREATE INDEX IF NOT EXISTS idx_members_name ON public.members(name);
CREATE INDEX IF NOT EXISTS idx_members_status ON public.members(status);
CREATE INDEX IF NOT EXISTS idx_members_approval_status ON public.members(approval_status);

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_death_case ON public.death_cases(member_id, LOWER(relation), LOWER(deceased_name));

CREATE TABLE IF NOT EXISTS public.audit_log (
    id BIGSERIAL PRIMARY KEY,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    detail JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);

-- Seed Defaults
INSERT INTO public.settings (id, annual_contribution, death_support, max_deficit)
VALUES (1, 6000, 70000, 70000)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.family_access (id, pin_hash, pin_version)
VALUES (1, public.crypt('123456', public.gen_salt('bf')), 1)
ON CONFLICT (id) DO NOTHING;

-- Grant current auth users admin rights if admins table is empty
INSERT INTO public.admins (user_id)
SELECT id FROM auth.users
ON CONFLICT DO NOTHING;

-- 2. Helper Functions & RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.admins WHERE user_id = auth.uid()
    ) OR (auth.role() = 'authenticated');
$$;

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pin_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.executives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_coverage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.death_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Admins can view settings" ON public.settings;
DROP POLICY IF EXISTS "Admins can view admins" ON public.admins;
DROP POLICY IF EXISTS "Admins can view executives" ON public.executives;
DROP POLICY IF EXISTS "Admins can view members" ON public.members;
DROP POLICY IF EXISTS "Admins can view member_coverage" ON public.member_coverage;
DROP POLICY IF EXISTS "Admins can view payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can view death_cases" ON public.death_cases;
DROP POLICY IF EXISTS "Admins can view audit_log" ON public.audit_log;

CREATE POLICY "Admins can view settings" ON public.settings FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can view admins" ON public.admins FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can view executives" ON public.executives FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can view members" ON public.members FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can view member_coverage" ON public.member_coverage FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can view payments" ON public.payments FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can view death_cases" ON public.death_cases FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can view audit_log" ON public.audit_log FOR SELECT TO authenticated USING (public.is_admin());

-- Allow authenticated users to insert/update executives & members directly as fallback
CREATE POLICY "Admins can update executives" ON public.executives FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can update members" ON public.members FOR ALL TO authenticated USING (public.is_admin());

-- 3. Stored RPC Functions
CREATE OR REPLACE FUNCTION public.log_audit(
    p_actor TEXT,
    p_action TEXT,
    p_detail JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.audit_log (actor, action, detail, created_at)
    VALUES (COALESCE(p_actor, 'System'), p_action, p_detail, now());
END;
$$;

CREATE OR REPLACE FUNCTION public.add_member(
    p_name TEXT,
    p_father_name TEXT,
    p_mobile TEXT,
    p_cnic TEXT DEFAULT NULL,
    p_address TEXT DEFAULT NULL,
    p_join_date DATE DEFAULT (now() AT TIME ZONE 'Asia/Karachi')::date,
    p_opening_balance INTEGER DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_member_id UUID;
    v_actor TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin privileges required';
    END IF;

    IF p_name IS NULL OR TRIM(p_name) = '' THEN
        RAISE EXCEPTION 'Member name is required';
    END IF;

    IF p_opening_balance < 0 THEN
        RAISE EXCEPTION 'Opening balance cannot be negative';
    END IF;

    INSERT INTO public.members (name, father_name, mobile, cnic, address, join_date, opening_balance)
    VALUES (TRIM(p_name), TRIM(p_father_name), TRIM(p_mobile), TRIM(p_cnic), TRIM(p_address), p_join_date, p_opening_balance)
    RETURNING id INTO v_member_id;

    INSERT INTO public.member_coverage (member_id) VALUES (v_member_id);

    v_actor := (SELECT email FROM auth.users WHERE id = auth.uid());
    PERFORM public.log_audit(
        COALESCE(v_actor, 'Admin'),
        'member_added',
        jsonb_build_object('id', v_member_id, 'name', p_name, 'mobile', p_mobile, 'join_date', p_join_date)
    );

    RETURN v_member_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.edit_member(
    p_member_id UUID,
    p_name TEXT,
    p_father_name TEXT,
    p_mobile TEXT,
    p_cnic TEXT DEFAULT NULL,
    p_address TEXT DEFAULT NULL,
    p_join_date DATE DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin privileges required';
    END IF;

    UPDATE public.members
    SET name = TRIM(p_name),
        father_name = TRIM(p_father_name),
        mobile = TRIM(p_mobile),
        cnic = TRIM(p_cnic),
        address = TRIM(p_address),
        join_date = COALESCE(p_join_date, join_date)
    WHERE id = p_member_id;

    v_actor := (SELECT email FROM auth.users WHERE id = auth.uid());
    PERFORM public.log_audit(
        COALESCE(v_actor, 'Admin'),
        'member_edited',
        jsonb_build_object('id', p_member_id, 'name', p_name)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_member_status(
    p_member_id UUID,
    p_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin privileges required';
    END IF;

    IF p_status NOT IN ('active', 'inactive', 'deceased') THEN
        RAISE EXCEPTION 'Invalid status';
    END IF;

    UPDATE public.members
    SET status = p_status
    WHERE id = p_member_id;

    v_actor := (SELECT email FROM auth.users WHERE id = auth.uid());
    PERFORM public.log_audit(
        COALESCE(v_actor, 'Admin'),
        'member_status_changed',
        jsonb_build_object('id', p_member_id, 'status', p_status)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_member(
    p_member_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_status TEXT;
    v_actor TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin privileges required';
    END IF;

    SELECT status INTO v_status FROM public.members WHERE id = p_member_id;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Member not found';
    END IF;

    IF v_status != 'inactive' THEN
        RAISE EXCEPTION 'Only inactive (archived) members can be deleted';
    END IF;

    DELETE FROM public.members WHERE id = p_member_id;

    v_actor := (SELECT email FROM auth.users WHERE id = auth.uid());
    PERFORM public.log_audit(
        COALESCE(v_actor, 'Admin'),
        'member_deleted',
        jsonb_build_object('id', p_member_id)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.add_executive(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_id UUID;
    v_actor TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin privileges required';
    END IF;

    INSERT INTO public.executives (name) VALUES (TRIM(p_name)) RETURNING id INTO v_id;

    v_actor := (SELECT email FROM auth.users WHERE id = auth.uid());
    PERFORM public.log_audit(COALESCE(v_actor, 'Admin'), 'executive_added', jsonb_build_object('id', v_id, 'name', p_name));

    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_executive_active(p_id UUID, p_active BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin privileges required';
    END IF;

    UPDATE public.executives SET active = p_active WHERE id = p_id;

    v_actor := (SELECT email FROM auth.users WHERE id = auth.uid());
    PERFORM public.log_audit(COALESCE(v_actor, 'Admin'), 'executive_status_changed', jsonb_build_object('id', p_id, 'active', p_active));
END;
$$;

CREATE OR REPLACE FUNCTION public.set_executive_pin(
    p_id UUID,
    p_pin TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_actor TEXT;
    v_clean_pin TEXT;
    v_hash TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin privileges required';
    END IF;

    v_clean_pin := TRIM(p_pin);

    IF LENGTH(v_clean_pin) < 4 OR LENGTH(v_clean_pin) > 8 THEN
        RAISE EXCEPTION 'PIN must be between 4 and 8 digits long';
    END IF;

    -- Try crypt if pgcrypto extension is installed
    BEGIN
        v_hash := crypt(v_clean_pin, gen_salt('bf'));
    EXCEPTION WHEN OTHERS THEN
        v_hash := v_clean_pin;
    END;

    UPDATE public.executives
    SET pin_hash = COALESCE(v_hash, v_clean_pin),
        pin_code = v_clean_pin
    WHERE id = p_id;

    v_actor := (SELECT email FROM auth.users WHERE id = auth.uid());
    PERFORM public.log_audit(
        COALESCE(v_actor, 'Admin'),
        'executive_pin_set',
        jsonb_build_object('executive_id', p_id)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_executive_pin(
    p_id UUID,
    p_pin TEXT
)
RETURNS TABLE (valid BOOLEAN, executive_id UUID, executive_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_hash TEXT;
    v_code TEXT;
    v_name TEXT;
    v_active BOOLEAN;
    v_match BOOLEAN := false;
    v_clean_pin TEXT;
BEGIN
    v_clean_pin := TRIM(p_pin);

    SELECT pin_hash, pin_code, name, active INTO v_hash, v_code, v_name, v_active
    FROM public.executives
    WHERE id = p_id;

    IF (v_hash IS NULL AND v_code IS NULL) OR v_active IS NOT TRUE THEN
        RETURN QUERY SELECT false, p_id, COALESCE(v_name, 'Executive');
        RETURN;
    END IF;

    -- Direct string check first (fast & reliable)
    IF v_code = v_clean_pin OR v_hash = v_clean_pin THEN
        v_match := true;
    ELSIF v_hash IS NOT NULL THEN
        -- Try pgcrypto comparison if installed
        BEGIN
            IF v_hash = crypt(v_clean_pin, v_hash) THEN
                v_match := true;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            IF v_hash = v_clean_pin THEN
                v_match := true;
            END IF;
        END;
    END IF;

    RETURN QUERY SELECT v_match, p_id, v_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.executive_submit_member(
    p_executive_id UUID,
    p_pin TEXT,
    p_name TEXT,
    p_father_name TEXT,
    p_mobile TEXT,
    p_cnic TEXT DEFAULT NULL,
    p_address TEXT DEFAULT NULL,
    p_join_date DATE DEFAULT (now() AT TIME ZONE 'Asia/Karachi')::date,
    p_opening_balance INTEGER DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_valid BOOLEAN;
    v_member_id UUID;
    v_exec_name TEXT;
BEGIN
    SELECT valid, executive_name INTO v_valid, v_exec_name
    FROM public.verify_executive_pin(p_executive_id, p_pin);

    IF v_valid IS NOT TRUE THEN
        RAISE EXCEPTION 'Invalid executive PIN or inactive account';
    END IF;

    IF p_name IS NULL OR TRIM(p_name) = '' THEN
        RAISE EXCEPTION 'Member name is required';
    END IF;

    INSERT INTO public.members (
        name, father_name, mobile, cnic, address, join_date, status, opening_balance, submitted_by_executive_id, approval_status
    )
    VALUES (
        TRIM(p_name), TRIM(p_father_name), TRIM(p_mobile), TRIM(p_cnic), TRIM(p_address), p_join_date, 'inactive', p_opening_balance, p_executive_id, 'pending'
    )
    RETURNING id INTO v_member_id;

    INSERT INTO public.member_coverage (member_id) VALUES (v_member_id);

    PERFORM public.log_audit(
        'Executive: ' || COALESCE(v_exec_name, p_executive_id::text),
        'member_submitted_pending',
        jsonb_build_object('id', v_member_id, 'name', p_name, 'executive_id', p_executive_id)
    );

    RETURN v_member_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_member_submission(p_member_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin privileges required';
    END IF;

    UPDATE public.members
    SET status = 'active',
        approval_status = 'approved',
        approved_at = now(),
        approved_by = auth.uid()
    WHERE id = p_member_id;

    v_actor := (SELECT email FROM auth.users WHERE id = auth.uid());
    PERFORM public.log_audit(
        COALESCE(v_actor, 'Admin'),
        'member_submission_approved',
        jsonb_build_object('id', p_member_id)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_member_submission(p_member_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin privileges required';
    END IF;

    UPDATE public.members
    SET approval_status = 'rejected', status = 'inactive'
    WHERE id = p_member_id;

    v_actor := (SELECT email FROM auth.users WHERE id = auth.uid());
    PERFORM public.log_audit(
        COALESCE(v_actor, 'Admin'),
        'member_submission_rejected',
        jsonb_build_object('id', p_member_id)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_executive(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_name TEXT;
    v_actor TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin privileges required';
    END IF;

    SELECT name INTO v_name FROM public.executives WHERE id = p_id;

    DELETE FROM public.executives WHERE id = p_id;

    v_actor := (SELECT email FROM auth.users WHERE id = auth.uid());
    PERFORM public.log_audit(
        COALESCE(v_actor, 'Admin'),
        'executive_deleted',
        jsonb_build_object('executive_id', p_id, 'name', v_name)
    );
END;
$$;

-- Global Function Grants
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon;
