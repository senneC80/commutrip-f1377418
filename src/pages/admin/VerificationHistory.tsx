import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { History, Search } from 'lucide-react';

interface HistoryRow {
  id: string;
  community_id: string;
  community_name: string;
  status: 'approved' | 'rejected';
  reviewer_name: string;
  decided_at: string | null;
}

export default function VerificationHistory() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('community_verifications')
        .select('id, community_id, status, reviewer_id, decided_at')
        .neq('status', 'pending')
        .order('decided_at', { ascending: false });
      if (!data) { setLoading(false); return; }
      const commIds = [...new Set(data.map(d => d.community_id))];
      const reviewerIds = [...new Set(data.map(d => d.reviewer_id).filter(Boolean) as string[])];
      const [{ data: comms }, { data: profs }] = await Promise.all([
        commIds.length ? supabase.from('communities').select('id, name').in('id', commIds) : Promise.resolve({ data: [] as any[] }),
        reviewerIds.length ? supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', reviewerIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const cMap: Record<string, string> = {};
      comms?.forEach((c: any) => { cMap[c.id] = c.name; });
      const rMap: Record<string, string> = {};
      profs?.forEach((p: any) => { rMap[p.user_id] = `${p.first_name} ${p.last_name}`.trim(); });
      setRows(data.map(d => ({
        id: d.id,
        community_id: d.community_id,
        community_name: cMap[d.community_id] || 'Unknown',
        status: d.status as any,
        reviewer_name: d.reviewer_id ? (rMap[d.reviewer_id] || 'Reviewer') : '—',
        decided_at: d.decided_at,
      })));
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(
    () => rows.filter(r => r.community_name.toLowerCase().includes(q.toLowerCase())),
    [rows, q],
  );

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-4xl space-y-5">
      <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
        <History className="h-6 w-6 text-primary" /> Verification History
      </h1>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Search community name…" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <Card className="shadow-card"><CardContent className="py-12 text-center text-muted-foreground">No decisions yet.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <Card key={r.id} className="shadow-card">
              <CardContent className="py-3 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-medium">{r.community_name}</h3>
                  <p className="text-xs text-muted-foreground">
                    Reviewed by {r.reviewer_name} · {r.decided_at ? new Date(r.decided_at).toLocaleDateString() : '—'}
                  </p>
                </div>
                <Badge variant={r.status === 'approved' ? 'default' : 'destructive'}>
                  {r.status === 'approved' ? 'Approved' : 'Rejected'}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
