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

export interface ProviderPledge {
  id: string;
  fund_id: string;
  pledge_percentage: number;
  is_active: boolean;
}

/**
 * Resolves the community fund (if any) for a provider, by looking up the
 * provider's accepted community membership and that community's fund.
 * Also returns the provider's active pledge to that fund, if any.
 */
export function useProviderCommunityFund(providerId: string | undefined | null) {
  const [fund, setFund] = useState<CommunityFund | null>(null);
  const [communityName, setCommunityName] = useState<string | null>(null);
  const [communityId, setCommunityId] = useState<string | null>(null);
  const [pledge, setPledge] = useState<ProviderPledge | null>(null);
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
        supabase.from('communities').select('id, name').eq('id', mem.community_id).maybeSingle(),
        supabase.from('community_funds').select('*').eq('community_id', mem.community_id).maybeSingle(),
      ]);
      if (cancelled) return;
      if (comm) { setCommunityName(comm.name); setCommunityId(comm.id); }
      if (f) {
        setFund(f as CommunityFund);
        const { data: p } = await supabase
          .from('provider_pledges')
          .select('id, fund_id, pledge_percentage, is_active')
          .eq('provider_id', providerId)
          .eq('fund_id', f.id)
          .eq('is_active', true)
          .maybeSingle();
        if (!cancelled && p) setPledge(p as ProviderPledge);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [providerId]);

  return { fund, communityName, communityId, pledge, loading };
}
