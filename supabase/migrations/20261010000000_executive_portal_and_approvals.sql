-- Migration: 20261010000000_executive_portal_and_approvals.sql
-- Description: Executive Portal PIN access, submission queue & Admin approvals

-- 1. Add pin_hash and pin_code to executives
ALTER TABLE public.executives ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE public.executives ADD COLUMN IF NOT EXISTS pin_code TEXT;

-- 2. Add approval tracking columns to members
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS submitted_by_executive_id UUID REFERENCES public.executives(id) ON DELETE SET NULL;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('approved', 'pending', 'rejected'));
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_members_approval_status ON public.members(approval_status);

-- 3. RPC: Set Executive PIN (Admin only)
CREATE OR REPLACE FUNCTION public.set_executive_pin(
    p_id UUID,
    p_pin TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor TEXT;
    v_clean_pin TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin privileges required';
    END IF;

    v_clean_pin := TRIM(p_pin);

    IF LENGTH(v_clean_pin) < 4 OR LENGTH(v_clean_pin) > 8 THEN
        RAISE EXCEPTION 'PIN must be between 4 and 8 digits long';
    END IF;

    UPDATE public.executives
    SET pin_hash = public.crypt(v_clean_pin, public.gen_salt('bf')),
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

-- 4. RPC: Verify Executive PIN (Public for Executive Portal)
CREATE OR REPLACE FUNCTION public.verify_executive_pin(
    p_id UUID,
    p_pin TEXT
)
RETURNS TABLE (valid BOOLEAN, executive_id UUID, executive_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

    IF (v_hash IS NOT NULL AND v_hash = public.crypt(v_clean_pin, v_hash))
       OR v_hash = v_clean_pin
       OR v_code = v_clean_pin THEN
        v_match := true;
    END IF;

    RETURN QUERY SELECT v_match, p_id, v_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_executive_pin(UUID, TEXT) TO anon, authenticated;

-- 5. RPC: Executive Submit Member
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
SET search_path = ''
AS $$
DECLARE
    v_valid BOOLEAN;
    v_member_id UUID;
    v_exec_name TEXT;
BEGIN
    -- Verify PIN
    SELECT valid, executive_name INTO v_valid, v_exec_name
    FROM public.verify_executive_pin(p_executive_id, p_pin);

    IF v_valid IS NOT TRUE THEN
        RAISE EXCEPTION 'Invalid executive PIN or inactive account';
    END IF;

    IF p_name IS NULL OR TRIM(p_name) = '' THEN
        RAISE EXCEPTION 'Member name is required';
    END IF;

    INSERT INTO public.members (
        name,
        father_name,
        mobile,
        cnic,
        address,
        join_date,
        status,
        opening_balance,
        submitted_by_executive_id,
        approval_status
    )
    VALUES (
        TRIM(p_name),
        TRIM(p_father_name),
        TRIM(p_mobile),
        TRIM(p_cnic),
        TRIM(p_address),
        p_join_date,
        'inactive',
        p_opening_balance,
        p_executive_id,
        'pending'
    )
    RETURNING id INTO v_member_id;

    -- Default coverage row
    INSERT INTO public.member_coverage (member_id) VALUES (v_member_id);

    PERFORM public.log_audit(
        'Executive: ' || COALESCE(v_exec_name, p_executive_id::text),
        'member_submitted_pending',
        jsonb_build_object('id', v_member_id, 'name', p_name, 'executive_id', p_executive_id)
    );

    RETURN v_member_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.executive_submit_member(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, INTEGER) TO anon, authenticated;

-- 6. RPC: Approve Member Submission (Admin only)
CREATE OR REPLACE FUNCTION public.approve_member_submission(
    p_member_id UUID
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

-- 7. RPC: Reject Member Submission (Admin only)
CREATE OR REPLACE FUNCTION public.reject_member_submission(
    p_member_id UUID
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
    SET approval_status = 'rejected',
        status = 'inactive'
    WHERE id = p_member_id;

    v_actor := (SELECT email FROM auth.users WHERE id = auth.uid());
    PERFORM public.log_audit(
        COALESCE(v_actor, 'Admin'),
        'member_submission_rejected',
        jsonb_build_object('id', p_member_id)
    );
END;
$$;

-- 8. RPC: Delete Executive (Admin only)
CREATE OR REPLACE FUNCTION public.delete_executive(
    p_id UUID
)
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

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon;
