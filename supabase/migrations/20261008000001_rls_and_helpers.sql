-- Migration: 20261008000001_rls_and_helpers.sql
-- Description: Helper function public.is_admin() and strict RLS policies

-- Helper function to check if current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.admins WHERE user_id = auth.uid()
    );
$$;

-- Enable RLS on all tables
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

-- Revoke default direct table permissions from anon and authenticated
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE SELECT ON public.family_access FROM anon, authenticated;
REVOKE SELECT ON public.pin_attempts FROM anon, authenticated;

-- Policies for Admins (SELECT only)
CREATE POLICY "Admins can view settings" ON public.settings FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can view admins" ON public.admins FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can view executives" ON public.executives FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can view members" ON public.members FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can view member_coverage" ON public.member_coverage FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can view payments" ON public.payments FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can view death_cases" ON public.death_cases FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can view audit_log" ON public.audit_log FOR SELECT TO authenticated USING (public.is_admin());
