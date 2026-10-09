-- Migration: 20261008000002_rpc_functions.sql
-- Description: SECURITY DEFINER RPC functions enforcing business rules (BR-1 to BR-33)

-- 1. Helper function to record audit log
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

-- 2. Add Member RPC
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

    -- Default coverage row
    INSERT INTO public.member_coverage (member_id)
    VALUES (v_member_id);

    v_actor := (SELECT email FROM auth.users WHERE id = auth.uid());
    PERFORM public.log_audit(
        COALESCE(v_actor, 'Admin'),
        'member_added',
        jsonb_build_object('id', v_member_id, 'name', p_name, 'mobile', p_mobile, 'join_date', p_join_date)
    );

    RETURN v_member_id;
END;
$$;

-- 3. Edit Member RPC
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

-- 4. Set Member Status RPC
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

-- 5. Delete Member (Only Inactive) RPC
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

-- 6. Continue Family RPC (BR-19)
CREATE OR REPLACE FUNCTION public.continue_family(
    p_deceased_id UUID,
    p_new_name TEXT,
    p_new_father_name TEXT,
    p_new_mobile TEXT,
    p_new_cnic TEXT DEFAULT NULL,
    p_new_address TEXT DEFAULT NULL,
    p_opening_balance INTEGER DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_new_id UUID;
    v_actor TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin privileges required';
    END IF;

    -- Create new member
    INSERT INTO public.members (name, father_name, mobile, cnic, address, join_date, opening_balance, continues_from)
    VALUES (TRIM(p_new_name), TRIM(p_new_father_name), TRIM(p_new_mobile), TRIM(p_new_cnic), TRIM(p_new_address), (now() AT TIME ZONE 'Asia/Karachi')::date, p_opening_balance, p_deceased_id)
    RETURNING id INTO v_new_id;

    -- Update deceased member
    UPDATE public.members
    SET continued_by = v_new_id
    WHERE id = p_deceased_id;

    -- Default coverage for new member
    INSERT INTO public.member_coverage (member_id) VALUES (v_new_id);

    v_actor := (SELECT email FROM auth.users WHERE id = auth.uid());
    PERFORM public.log_audit(
        COALESCE(v_actor, 'Admin'),
        'family_continued',
        jsonb_build_object('deceased_id', p_deceased_id, 'new_member_id', v_new_id, 'opening_balance', p_opening_balance)
    );

    RETURN v_new_id;
END;
$$;

-- 7. Save Coverage RPC
CREATE OR REPLACE FUNCTION public.save_coverage(
    p_member_id UUID,
    p_sons INTEGER,
    p_daughters INTEGER,
    p_wife INTEGER,
    p_father INTEGER,
    p_mother INTEGER,
    p_brothers INTEGER,
    p_sisters INTEGER,
    p_other_dependents INTEGER
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

    INSERT INTO public.member_coverage (member_id, sons, daughters, wife, father, mother, brothers, sisters, other_dependents, updated_at)
    VALUES (p_member_id, p_sons, p_daughters, p_wife, p_father, p_mother, p_brothers, p_sisters, p_other_dependents, now())
    ON CONFLICT (member_id) DO UPDATE
    SET sons = EXCLUDED.sons,
        daughters = EXCLUDED.daughters,
        wife = EXCLUDED.wife,
        father = EXCLUDED.father,
        mother = EXCLUDED.mother,
        brothers = EXCLUDED.brothers,
        sisters = EXCLUDED.sisters,
        other_dependents = EXCLUDED.other_dependents,
        updated_at = now();

    v_actor := (SELECT email FROM auth.users WHERE id = auth.uid());
    PERFORM public.log_audit(
        COALESCE(v_actor, 'Admin'),
        'coverage_updated',
        jsonb_build_object('member_id', p_member_id)
    );
END;
$$;

-- 8. Add Payment RPC (BR-8, BR-9, BR-10, BR-11)
CREATE OR REPLACE FUNCTION public.add_payment(
    p_member_id UUID,
    p_amount INTEGER,
    p_payment_date DATE,
    p_executive_id UUID DEFAULT NULL,
    p_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_payment_id UUID;
    v_join_date DATE;
    v_annual INT := 6000;
    v_total_paid INT := 0;
    v_opening INT := 0;
    v_cur_year INT;
    v_join_year INT;
    v_years_due INT;
    v_total_due INT;
    v_max_allowed INT;
    v_actor TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin privileges required';
    END IF;

    -- BR-9: Whole number > 0
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero';
    END IF;

    -- Member details
    SELECT join_date, opening_balance INTO v_join_date, v_opening
    FROM public.members WHERE id = p_member_id;

    IF v_join_date IS NULL THEN
        RAISE EXCEPTION 'Member not found';
    END IF;

    -- BR-11: Payment date not before join date
    IF p_payment_date < v_join_date THEN
        RAISE EXCEPTION 'Payment date cannot be before member join date';
    END IF;

    -- BR-10: Max 1 year ahead cap
    v_cur_year := EXTRACT(YEAR FROM (now() AT TIME ZONE 'Asia/Karachi'))::INT;
    v_join_year := EXTRACT(YEAR FROM v_join_date)::INT;
    v_years_due := GREATEST(1, v_cur_year - v_join_year + 1);

    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM public.payments WHERE member_id = p_member_id;

    -- Get settings if customized
    SELECT annual_contribution INTO v_annual FROM public.settings WHERE id = 1;

    v_total_due := (v_years_due * v_annual) + v_opening;
    v_max_allowed := GREATEST(0, (v_total_due + v_annual) - v_total_paid);

    IF p_amount > v_max_allowed THEN
        RAISE EXCEPTION 'Amount exceeds maximum allowed limit (Rs. %)', v_max_allowed;
    END IF;

    INSERT INTO public.payments (member_id, amount, type, payment_date, executive_id, note, created_by)
    VALUES (p_member_id, p_amount, 'payment', p_payment_date, p_executive_id, TRIM(p_note), auth.uid())
    RETURNING id INTO v_payment_id;

    v_actor := (SELECT email FROM auth.users WHERE id = auth.uid());
    PERFORM public.log_audit(
        COALESCE(v_actor, 'Admin'),
        'payment_saved',
        jsonb_build_object('id', v_payment_id, 'member_id', p_member_id, 'amount', p_amount, 'payment_date', p_payment_date)
    );

    RETURN v_payment_id;
END;
$$;

-- 9. Reverse Payment RPC (BR-12)
CREATE OR REPLACE FUNCTION public.reverse_payment(
    p_payment_id UUID,
    p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_orig public.payments%ROWTYPE;
    v_already_reversed BOOLEAN;
    v_reversal_id UUID;
    v_actor TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin privileges required';
    END IF;

    IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
        RAISE EXCEPTION 'Reversal reason is required';
    END IF;

    SELECT * INTO v_orig FROM public.payments WHERE id = p_payment_id;

    IF v_orig.id IS NULL THEN
        RAISE EXCEPTION 'Original payment not found';
    END IF;

    IF v_orig.type = 'reversal' THEN
        RAISE EXCEPTION 'Cannot reverse a reversal transaction';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.payments WHERE reverses = p_payment_id
    ) INTO v_already_reversed;

    IF v_already_reversed THEN
        RAISE EXCEPTION 'Payment has already been reversed';
    END IF;

    INSERT INTO public.payments (member_id, amount, type, reverses, payment_date, executive_id, note, created_by)
    VALUES (v_orig.member_id, -v_orig.amount, 'reversal', p_payment_id, (now() AT TIME ZONE 'Asia/Karachi')::date, v_orig.executive_id, TRIM(p_reason), auth.uid())
    RETURNING id INTO v_reversal_id;

    v_actor := (SELECT email FROM auth.users WHERE id = auth.uid());
    PERFORM public.log_audit(
        COALESCE(v_actor, 'Admin'),
        'payment_reversed',
        jsonb_build_object('original_id', p_payment_id, 'reversal_id', v_reversal_id, 'reason', p_reason)
    );

    RETURN v_reversal_id;
END;
$$;

-- 10. Register Death Case RPC
CREATE OR REPLACE FUNCTION public.register_case(
    p_member_id UUID,
    p_deceased_name TEXT,
    p_relation TEXT,
    p_death_date DATE,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_case_id UUID;
    v_count INT;
    v_ref TEXT;
    v_amount INT := 70000;
    v_actor TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin privileges required';
    END IF;

    SELECT death_support INTO v_amount FROM public.settings WHERE id = 1;

    SELECT COUNT(*) + 1 INTO v_count FROM public.death_cases;
    v_ref := 'DS-' || LPAD(v_count::TEXT, 3, '0');

    INSERT INTO public.death_cases (member_id, ref, deceased_name, relation, death_date, status, amount, notes)
    VALUES (p_member_id, v_ref, TRIM(p_deceased_name), TRIM(p_relation), p_death_date, 'registered', v_amount, TRIM(p_notes))
    RETURNING id INTO v_case_id;

    v_actor := (SELECT email FROM auth.users WHERE id = auth.uid());
    PERFORM public.log_audit(
        COALESCE(v_actor, 'Admin'),
        'case_registered',
        jsonb_build_object('id', v_case_id, 'ref', v_ref, 'member_id', p_member_id, 'deceased_name', p_deceased_name)
    );

    RETURN v_case_id;
END;
$$;

-- 11. Verify Death Case RPC
CREATE OR REPLACE FUNCTION public.verify_case(
    p_case_id UUID
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

    UPDATE public.death_cases
    SET status = 'verified',
        verified_at = now(),
        verified_by = auth.uid()
    WHERE id = p_case_id;

    v_actor := (SELECT email FROM auth.users WHERE id = auth.uid());
    PERFORM public.log_audit(
        COALESCE(v_actor, 'Admin'),
        'case_verified',
        jsonb_build_object('id', p_case_id)
    );
END;
$$;

-- 12. Release Death Support Payout RPC (BR-21, BR-23, BR-25, BR-26)
CREATE OR REPLACE FUNCTION public.release_case(
    p_case_id UUID,
    p_deficit_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_case public.death_cases%ROWTYPE;
    v_collected INT := 0;
    v_paid_out INT := 0;
    v_balance INT := 0;
    v_max_deficit INT := 70000;
    v_balance_after INT;
    v_actor TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin privileges required';
    END IF;

    SELECT * INTO v_case FROM public.death_cases WHERE id = p_case_id;

    IF v_case.id IS NULL THEN
        RAISE EXCEPTION 'Death case not found';
    END IF;

    IF v_case.status = 'paid' THEN
        RAISE EXCEPTION 'Case payout has already been released';
    END IF;

    -- Calculate current balance
    SELECT COALESCE(SUM(amount), 0) INTO v_collected FROM public.payments;
    SELECT COALESCE(SUM(amount), 0) INTO v_paid_out FROM public.death_cases WHERE status = 'paid';
    v_balance := v_collected - v_paid_out;

    SELECT max_deficit INTO v_max_deficit FROM public.settings WHERE id = 1;

    v_balance_after := v_balance - v_case.amount;

    -- BR-26 Block if balance_after < -max_deficit
    IF v_balance_after < -v_max_deficit THEN
        RAISE EXCEPTION 'Release blocked: Fund deficit exceeds maximum allowed limit (Rs. %)', v_max_deficit;
    END IF;

    -- BR-25 Deficit reason required if balance_after < 0
    IF v_balance_after < 0 AND (p_deficit_reason IS NULL OR TRIM(p_deficit_reason) = '') THEN
        RAISE EXCEPTION 'Deficit reason is required when payout leaves fund in negative balance';
    END IF;

    UPDATE public.death_cases
    SET status = 'paid',
        paid_at = now(),
        paid_by = auth.uid(),
        deficit_reason = TRIM(p_deficit_reason)
    WHERE id = p_case_id;

    -- BR-23 Self relation updates member status to deceased
    IF LOWER(v_case.relation) = 'self' THEN
        UPDATE public.members SET status = 'deceased' WHERE id = v_case.member_id;
    END IF;

    v_actor := (SELECT email FROM auth.users WHERE id = auth.uid());
    PERFORM public.log_audit(
        COALESCE(v_actor, 'Admin'),
        'case_released',
        jsonb_build_object('id', p_case_id, 'amount', v_case.amount, 'deficit_reason', p_deficit_reason)
    );
END;
$$;

-- 13. Executive RPCs
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

-- 14. Change Family PIN RPC (BR-29)
CREATE OR REPLACE FUNCTION public.change_family_pin(p_new_pin TEXT)
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

    IF LENGTH(p_new_pin) < 6 OR LENGTH(p_new_pin) > 8 THEN
        RAISE EXCEPTION 'PIN must be 6 to 8 digits long';
    END IF;

    INSERT INTO public.family_access (id, pin_hash, pin_version, updated_at)
    VALUES (1, crypt(p_new_pin, gen_salt('bf')), 1, now())
    ON CONFLICT (id) DO UPDATE
    SET pin_hash = crypt(p_new_pin, gen_salt('bf')),
        pin_version = public.family_access.pin_version + 1,
        updated_at = now();

    v_actor := (SELECT email FROM auth.users WHERE id = auth.uid());
    PERFORM public.log_audit(COALESCE(v_actor, 'Admin'), 'pin_changed', '{}'::jsonb);
END;
$$;

-- 15. Duplicate Mobile Search RPC (BR-16)
CREATE OR REPLACE FUNCTION public.find_duplicate_mobile(p_mobile TEXT)
RETURNS TABLE (id UUID, name TEXT, mobile TEXT, status TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
    SELECT m.id, m.name, m.mobile, m.status
    FROM public.members m
    WHERE m.mobile = TRIM(p_mobile);
$$;
