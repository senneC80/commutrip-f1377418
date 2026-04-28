-- Returns the community_id for a provider's accepted membership (if any)
CREATE OR REPLACE FUNCTION public.get_provider_accepted_community(_provider_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT community_id FROM public.community_members
  WHERE provider_id = _provider_id AND status = 'accepted'
  LIMIT 1;
$$;

-- Bulk variant: returns accepted (provider_id, community_id) pairs for a list of providers
CREATE OR REPLACE FUNCTION public.get_providers_accepted_communities(_provider_ids uuid[])
RETURNS TABLE(provider_id uuid, community_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT provider_id, community_id FROM public.community_members
  WHERE status = 'accepted' AND provider_id = ANY(_provider_ids);
$$;