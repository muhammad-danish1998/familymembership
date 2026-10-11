-- Migration: Ensure both other_dependents and other columns exist on member_coverage
-- This guarantees backward and forward compatibility with all client queries

ALTER TABLE public.member_coverage ADD COLUMN IF NOT EXISTS other_dependents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.member_coverage ADD COLUMN IF NOT EXISTS other INTEGER NOT NULL DEFAULT 0;

-- Function to synchronize other and other_dependents
CREATE OR REPLACE FUNCTION public.sync_member_coverage_columns()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.other IS NOT NULL AND NEW.other != 0 AND (NEW.other_dependents IS NULL OR NEW.other_dependents = 0) THEN
        NEW.other_dependents := NEW.other;
    ELSIF NEW.other_dependents IS NOT NULL THEN
        NEW.other := NEW.other_dependents;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_member_coverage_columns ON public.member_coverage;
CREATE TRIGGER trg_sync_member_coverage_columns
BEFORE INSERT OR UPDATE ON public.member_coverage
FOR EACH ROW EXECUTE FUNCTION public.sync_member_coverage_columns();
