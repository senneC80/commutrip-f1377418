-- Verification status enum
DO $$ BEGIN
  CREATE TYPE public.verification_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Verifications table
CREATE TABLE IF NOT EXISTS public.community_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID NOT NULL,
  submitter_id UUID NOT NULL,
  ownership_type TEXT NOT NULL,
  revenue_distribution TEXT NOT NULL,
  certifications TEXT,
  narrative TEXT NOT NULL,
  status public.verification_status NOT NULL DEFAULT 'pending',
  reviewer_id UUID,
  reviewer_notes TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one pending submission per community
CREATE UNIQUE INDEX IF NOT EXISTS community_verifications_one_pending
  ON public.community_verifications(community_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS community_verifications_community_id_idx
  ON public.community_verifications(community_id);

ALTER TABLE public.community_verifications ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read verification records (badges, statuses)
CREATE POLICY "Anyone can read verifications"
  ON public.community_verifications FOR SELECT
  TO authenticated
  USING (true);

-- Community managers can submit for their own community
CREATE POLICY "Managers can submit verification"
  ON public.community_verifications FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = submitter_id
    AND EXISTS (
      SELECT 1 FROM public.communities
      WHERE id = community_id AND manager_id = auth.uid()
    )
  );

-- Admins can update (review)
CREATE POLICY "Admins can review verifications"
  ON public.community_verifications FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_community_verifications_updated_at ON public.community_verifications;
CREATE TRIGGER update_community_verifications_updated_at
  BEFORE UPDATE ON public.community_verifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: is a community currently verified?
CREATE OR REPLACE FUNCTION public.is_community_verified(_community_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_verifications
    WHERE community_id = _community_id AND status = 'approved'
  );
$$;
