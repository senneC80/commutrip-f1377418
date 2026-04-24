import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Returns a Set of community IDs that currently have an approved CBT verification.
 */
export function useVerifiedCommunities() {
  const [verifiedIds, setVerifiedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('community_verifications')
        .select('community_id')
        .eq('status', 'approved');
      setVerifiedIds(new Set((data || []).map((r: any) => r.community_id)));
      setLoading(false);
    })();
  }, []);

  return { verifiedIds, loading };
}
