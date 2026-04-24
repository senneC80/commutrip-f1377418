import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CommunityFund {
  id: string;
  community_id: string;
  description: string;
  purpose: string;
  target_amount: number | null;
  currency: string;
  show_history_publicly: boolean;
}

/**
 * Resolves the community fund (if any) for a provider, by looking up the
 * provider's accepted community membership and that community's fund.
 */
export function useProviderCommunityFund(providerId: string | undefined | null) {
  const [fund, setFund] = useState<CommunityFund | null>(null);
  const [communityName, setCommunityName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!providerId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: mem } = await supabase
        .from('community_members')
        .select('community_id')
        .eq('provider_id', providerId)
        .eq('status', 'accepted')
        .maybeSingle();
      if (!mem || cancelled) { setLoading(false); return; }
      const [{ data: comm }, { data: f }] = await Promise.all([
        supabase.from('communities').select('name').eq('id', mem.community_id).maybeSingle(),
        supabase.from('community_funds').select('*').eq('community_id', mem.community_id).maybeSingle(),
      ]);
      if (cancelled) return;
      if (comm) setCommunityName(comm.name);
      if (f) setFund(f as CommunityFund);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [providerId]);

  return { fund, communityName, loading };
}
