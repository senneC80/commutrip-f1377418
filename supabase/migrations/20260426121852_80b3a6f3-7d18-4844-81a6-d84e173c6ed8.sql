
-- Fix 1: Drop voluntary_contribution_amount from bookings
ALTER TABLE public.bookings DROP COLUMN IF EXISTS voluntary_contribution_amount;

-- Fix 2: Re-key provider_pledges to fund_id

-- Add fund_id column (nullable first so we can backfill)
ALTER TABLE public.provider_pledges ADD COLUMN IF NOT EXISTS fund_id uuid;

-- Backfill fund_id from community_id via community_funds
UPDATE public.provider_pledges p
SET fund_id = f.id
FROM public.community_funds f
WHERE f.community_id = p.community_id AND p.fund_id IS NULL;

-- Delete any pledges that have no matching fund (orphans — pledge to a community without a fund made no sense)
DELETE FROM public.provider_pledges WHERE fund_id IS NULL;

-- Drop old unique constraint on (provider_id, community_id) if it exists
DO $$
DECLARE
  c_name text;
BEGIN
  SELECT conname INTO c_name
  FROM pg_constraint
  WHERE conrelid = 'public.provider_pledges'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) LIKE '%provider_id%community_id%';
  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.provider_pledges DROP CONSTRAINT %I', c_name);
  END IF;
END $$;

-- Drop the community_id column
ALTER TABLE public.provider_pledges DROP COLUMN IF EXISTS community_id;

-- Make fund_id NOT NULL and add FK with cascade
ALTER TABLE public.provider_pledges ALTER COLUMN fund_id SET NOT NULL;

ALTER TABLE public.provider_pledges
  ADD CONSTRAINT provider_pledges_fund_id_fkey
  FOREIGN KEY (fund_id) REFERENCES public.community_funds(id) ON DELETE CASCADE;

ALTER TABLE public.provider_pledges
  ADD CONSTRAINT provider_pledges_provider_id_fkey
  FOREIGN KEY (provider_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- New unique constraint on (provider_id, fund_id)
ALTER TABLE public.provider_pledges
  ADD CONSTRAINT provider_pledges_provider_fund_unique UNIQUE (provider_id, fund_id);

-- Update the trigger function to look up pledge via fund
CREATE OR REPLACE FUNCTION public.handle_booking_completed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fund RECORD;
  v_pledge RECORD;
  v_amount NUMERIC;
  v_community_id uuid;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    IF NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;

    -- Find the provider's accepted community
    SELECT community_id INTO v_community_id
    FROM public.community_members
    WHERE provider_id = NEW.provider_id AND status = 'accepted'
    LIMIT 1;

    IF v_community_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Find the fund for that community
    SELECT * INTO v_fund
    FROM public.community_funds
    WHERE community_id = v_community_id;

    IF NOT FOUND THEN
      RETURN NEW;
    END IF;

    -- Find an active pledge from this provider to that fund
    SELECT * INTO v_pledge
    FROM public.provider_pledges
    WHERE provider_id = NEW.provider_id
      AND fund_id = v_fund.id
      AND is_active = true
    LIMIT 1;

    IF FOUND THEN
      v_amount := ROUND((COALESCE(NEW.total_price, 0) * v_pledge.pledge_percentage / 100)::numeric, 2);
      IF v_amount > 0 THEN
        INSERT INTO public.fund_contributions (fund_id, source_type, contributor_id, booking_id, amount, currency)
        VALUES (v_fund.id, 'provider_pledge', NEW.provider_id, NEW.id, v_amount, v_fund.currency);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
