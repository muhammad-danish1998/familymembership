-- Migration: 20261014000001_admin_edit_payment.sql
-- Description: Allow Admin to edit payments and add update policy

-- 1. Allow Admins to update payments directly
DROP POLICY IF EXISTS "Admins can update payments" ON public.payments;
CREATE POLICY "Admins can update payments" ON public.payments
FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 2. Create public.edit_payment RPC
CREATE OR REPLACE FUNCTION public.edit_payment(
    p_payment_id UUID,
    p_amount INTEGER,
    p_payment_date DATE,
    p_executive_id UUID DEFAULT NULL,
    p_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor TEXT;
    v_old_amount INT;
    v_old_date DATE;
    v_type TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin privileges required';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero';
    END IF;

    SELECT amount, payment_date, type INTO v_old_amount, v_old_date, v_type
    FROM public.payments
    WHERE id = p_payment_id;

    IF v_type IS NULL THEN
        RAISE EXCEPTION 'Payment not found';
    END IF;

    IF v_type = 'reversal' THEN
        RAISE EXCEPTION 'Cannot edit a reversal transaction directly';
    END IF;

    UPDATE public.payments
    SET amount = p_amount,
        payment_date = p_payment_date,
        executive_id = p_executive_id,
        note = TRIM(p_note)
    WHERE id = p_payment_id;

    v_actor := (SELECT email FROM auth.users WHERE id = auth.uid());
    PERFORM public.log_audit(
        COALESCE(v_actor, 'Admin'),
        'payment_edited',
        jsonb_build_object(
            'id', p_payment_id,
            'old_amount', v_old_amount,
            'new_amount', p_amount,
            'old_date', v_old_date,
            'new_date', p_payment_date
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.edit_payment(UUID, INTEGER, DATE, UUID, TEXT) TO authenticated, anon;
