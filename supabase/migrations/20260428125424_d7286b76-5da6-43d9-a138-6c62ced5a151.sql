CREATE OR REPLACE FUNCTION public.get_verified_community_ids()
RETURNS TABLE(community_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT community_id FROM public.community_verifications WHERE status = 'approved';
$$;

CREATE OR REPLACE FUNCTION public.get_community_member_counts()
RETURNS TABLE(community_id uuid, member_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT community_id, COUNT(*)::bigint
  FROM public.community_members
  WHERE status = 'accepted'
  GROUP BY community_id;
$$;