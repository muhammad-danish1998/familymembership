-- Migration: 20261014000000_executive_edit_and_admin_amount_correction.sql
-- Description: Allow Admin to correct opening_balance amount and allow Executives to edit member details (with locked amount after approval and mandatory re-approval)

-- 1. Update public.edit_member to accept p_opening_balance
CREATE OR REPLACE FUNCTION public.edit_member(
    p_member_id UUID,
    p_name TEXT,
    p_father_name TEXT,
    p_mobile TEXT,
    p_cnic TEXT DEFAULT NULL,
    p_address TEXT DEFAULT NULL,
    p_join_date DATE DEFAULT NULL,
    p_opening_balance INTEGER DEFAULT NULL
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
        join_date = COALESCE(p_join_date, join_date),
        opening_balance = COALESCE(p_opening_balance, opening_balance)
    WHERE id = p_member_id;

    v_actor := (SELECT email FROM auth.users WHERE id = auth.uid());
    PERFORM public.log_audit(
        COALESCE(v_actor, 'Admin'),
        'member_edited',
        jsonb_build_object('id', p_member_id, 'name', p_name, 'opening_balance', p_opening_balance)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.edit_member(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, INTEGER) TO authenticated, anon;

-- 2. Create public.executive_update_member
CREATE OR REPLACE FUNCTION public.executive_update_member(
    p_executive_id UUID,
    p_pin TEXT,
    p_member_id UUID,
    p_name TEXT,
    p_father_name TEXT,
    p_mobile TEXT,
    p_cnic TEXT DEFAULT NULL,
    p_join_date DATE DEFAULT NULL,
    p_opening_balance INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_valid BOOLEAN;
    v_exec_name TEXT;
    v_current_sub_id UUID;
    v_current_app_status TEXT;
BEGIN
    -- Verify PIN
    SELECT valid, executive_name INTO v_valid, v_exec_name
    FROM public.verify_executive_pin(p_executive_id, p_pin);

    IF v_valid IS NOT TRUE THEN
        RAISE EXCEPTION 'Invalid executive PIN or inactive account';
    END IF;

    -- Verify ownership
    SELECT submitted_by_executive_id, approval_status
    INTO v_current_sub_id, v_current_app_status
    FROM public.members
    WHERE id = p_member_id;

    IF v_current_sub_id IS DISTINCT FROM p_executive_id THEN
        RAISE EXCEPTION 'You are only allowed to edit members submitted by you';
    END IF;

    -- If already approved, executive cannot change opening_balance
    -- If not approved (pending/rejected), opening_balance can be updated
    UPDATE public.members
    SET name = TRIM(p_name),
        father_name = TRIM(p_father_name),
        mobile = TRIM(p_mobile),
        cnic = TRIM(p_cnic),
        join_date = COALESCE(p_join_date, join_date),
        opening_balance = CASE
            WHEN v_current_app_status = 'approved' THEN opening_balance
            ELSE COALESCE(p_opening_balance, opening_balance)
        END,
        approval_status = 'pending' -- Requires Admin re-approval!
    WHERE id = p_member_id;

    PERFORM public.log_audit(
        'Executive: ' || COALESCE(v_exec_name, p_executive_id::text),
        'member_edited_by_executive',
        jsonb_build_object('id', p_member_id, 'name', p_name, 'status', 'pending')
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.executive_update_member(UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, DATE, INTEGER) TO anon, authenticated;
