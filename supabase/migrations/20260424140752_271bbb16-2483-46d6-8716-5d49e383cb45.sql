
-- 1. Community Funds
CREATE TABLE public.community_funds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL UNIQUE,
  description TEXT NOT NULL,
  purpose TEXT NOT NULL,
  target_amount NUMERIC,
  currency TEXT NOT NULL DEFAULT 'EUR',
  show_history_publicly BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.community_funds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read funds"
ON public.community_funds FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Manager can manage fund"
ON public.community_funds FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.communities c WHERE c.id = community_funds.community_id AND c.manager_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.communities c WHERE c.id = community_funds.community_id AND c.manager_id = auth.uid()));

CREATE TRIGGER community_funds_updated
BEFORE UPDATE ON public.community_funds
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Provider Pledges
CREATE TABLE public.provider_pledges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL,
  community_id UUID NOT NULL,
  pledge_percentage NUMERIC NOT NULL CHECK (pledge_percentage >= 0 AND pledge_percentage <= 50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_id, community_id)
);

ALTER TABLE public.provider_pledges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read pledges"
ON public.provider_pledges FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Providers manage own pledge"
ON public.provider_pledges FOR ALL TO authenticated
USING (auth.uid() = provider_id)
WITH CHECK (auth.uid() = provider_id);

CREATE TRIGGER provider_pledges_updated
BEFORE UPDATE ON public.provider_pledges
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Fund Contributions
CREATE TABLE public.fund_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id UUID NOT NULL REFERENCES public.community_funds(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('provider_pledge', 'traveller_topup')),
  contributor_id UUID NOT NULL,
  booking_id UUID,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fund_contributions_fund ON public.fund_contributions(fund_id);
CREATE INDEX idx_fund_contributions_contributor ON public.fund_contributions(contributor_id);
CREATE UNIQUE INDEX idx_fund_contributions_unique_pledge
  ON public.fund_contributions(booking_id) WHERE source_type = 'provider_pledge';

ALTER TABLE public.fund_contributions ENABLE ROW LEVEL SECURITY;

-- Read: manager always; contributor always; everyone if fund opted-in to public history
CREATE POLICY "Public read when fund opted in"
ON public.fund_contributions FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.community_funds f WHERE f.id = fund_contributions.fund_id AND f.show_history_publicly = true)
  OR contributor_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.community_funds f
    JOIN public.communities c ON c.id = f.community_id
    WHERE f.id = fund_contributions.fund_id AND c.manager_id = auth.uid()
  )
);

-- Insert: travellers create their own top-ups; provider pledges go in via trigger (security definer)
CREATE POLICY "Travellers insert own topups"
ON public.fund_contributions FOR INSERT TO authenticated
WITH CHECK (
  source_type = 'traveller_topup'
  AND contributor_id = auth.uid()
);

-- 4. Impact Reports
CREATE TABLE public.impact_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL,
  author_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  metrics JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_impact_reports_community ON public.impact_reports(community_id);

ALTER TABLE public.impact_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published reports"
ON public.impact_reports FOR SELECT TO authenticated
USING (
  status = 'published'
  OR EXISTS (SELECT 1 FROM public.communities c WHERE c.id = impact_reports.community_id AND c.manager_id = auth.uid())
);

CREATE POLICY "Manager can manage reports"
ON public.impact_reports FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.communities c WHERE c.id = impact_reports.community_id AND c.manager_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.communities c WHERE c.id = impact_reports.community_id AND c.manager_id = auth.uid()));

CREATE TRIGGER impact_reports_updated
BEFORE UPDATE ON public.impact_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Bookings extensions
ALTER TABLE public.bookings
  ADD COLUMN voluntary_contribution_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN completed_at TIMESTAMPTZ;

-- 6. Trigger: when booking marked completed, generate provider pledge contribution
CREATE OR REPLACE FUNCTION public.handle_booking_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pledge RECORD;
  v_fund RECORD;
  v_amount NUMERIC;
BEGIN
  -- Only act when transitioning into completed
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    IF NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;

    -- Find an active pledge for this provider
    SELECT * INTO v_pledge
    FROM public.provider_pledges
    WHERE provider_id = NEW.provider_id AND is_active = true
    LIMIT 1;

    IF FOUND THEN
      SELECT f.* INTO v_fund
      FROM public.community_funds f
      WHERE f.community_id = v_pledge.community_id;

      IF FOUND THEN
        v_amount := ROUND((COALESCE(NEW.total_price, 0) * v_pledge.pledge_percentage / 100)::numeric, 2);
        IF v_amount > 0 THEN
          INSERT INTO public.fund_contributions (fund_id, source_type, contributor_id, booking_id, amount, currency)
          VALUES (v_fund.id, 'provider_pledge', NEW.provider_id, NEW.id, v_amount, v_fund.currency)
          ON CONFLICT (booking_id) WHERE source_type = 'provider_pledge' DO NOTHING;
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER bookings_completed_pledge
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.handle_booking_completed();

-- 7. Helper: fund balance (security definer so anyone can compute it cleanly)
CREATE OR REPLACE FUNCTION public.get_fund_balance(_fund_id uuid)
RETURNS NUMERIC
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount), 0) FROM public.fund_contributions WHERE fund_id = _fund_id;
$$;
