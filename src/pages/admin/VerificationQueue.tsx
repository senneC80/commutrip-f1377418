import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck } from 'lucide-react';

interface PendingRow {
  id: string;
  community_id: string;
  community_name: string;
  created_at: string;
}

export default function VerificationQueue() {
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('community_verifications')
        .select('id, community_id, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      if (!data) { setLoading(false); return; }
      const commIds = [...new Set(data.map(d => d.community_id))];
      const { data: comms } = await supabase.from('communities').select('id, name').in('id', commIds);
      const nameMap: Record<string, string> = {};
      comms?.forEach(c => { nameMap[c.id] = c.name; });
      setRows(data.map(d => ({ ...d, community_name: nameMap[d.community_id] || 'Unknown' })));
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" /> Verification Queue
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{rows.length} pending {rows.length === 1 ? 'submission' : 'submissions'} awaiting review.</p>
      </div>

      {rows.length === 0 ? (
        <Card className="shadow-card"><CardContent className="py-12 text-center text-muted-foreground">No pending submissions. 🎉</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {rows.map(r => (
            <Card key={r.id} className="shadow-card">
              <CardContent className="py-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-heading font-semibold">{r.community_name}</h3>
                  <p className="text-xs text-muted-foreground">Submitted {new Date(r.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Pending</Badge>
                  <Link to={`/admin/review/${r.id}`}>
                    <Button size="sm">Review</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
