-- Fix 1: Restrict community_verifications SELECT
DROP POLICY IF EXISTS "Anyone can read verifications" ON public.community_verifications;

CREATE POLICY "Submitter, manager, or admin can read verifications"
ON public.community_verifications
FOR SELECT
TO authenticated
USING (
  auth.uid() = submitter_id
  OR EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.id = community_verifications.community_id AND c.manager_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Public verification status accessor
CREATE OR REPLACE FUNCTION public.get_community_verification_status(_community_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT status::text FROM public.community_verifications
      WHERE community_id = _community_id
      ORDER BY COALESCE(decided_at, created_at) DESC
      LIMIT 1),
    'unverified'
  );
$$;

-- Fix 2: Restrict community_members SELECT
DROP POLICY IF EXISTS "Members can read community members" ON public.community_members;

CREATE POLICY "Member or manager can read membership"
ON public.community_members
FOR SELECT
TO authenticated
USING (
  auth.uid() = provider_id
  OR EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.id = community_members.community_id AND c.manager_id = auth.uid()
  )
);

-- Public accessor for accepted members of a community
CREATE OR REPLACE FUNCTION public.get_accepted_community_members(_community_id uuid)
RETURNS TABLE(provider_id uuid, joined_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT provider_id, joined_at
  FROM public.community_members
  WHERE community_id = _community_id AND status = 'accepted';
$$;