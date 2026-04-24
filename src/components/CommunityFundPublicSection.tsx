import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Heart, FileText, Users, User } from 'lucide-react';
import { format } from 'date-fns';
import { formatMoney } from '@/lib/pricing';
import MarkdownPreview from '@/components/MarkdownPreview';

interface Fund {
  id: string;
  description: string;
  purpose: string;
  target_amount: number | null;
  currency: string;
  show_history_publicly: boolean;
}

interface Contribution {
  id: string;
  source_type: 'provider_pledge' | 'traveller_topup';
  contributor_id: string;
  amount: number;
  currency: string;
  created_at: string;
  contributor_name?: string;
}

interface Metric { label: string; value: string; }
interface Report {
  id: string;
  title: string;
  body: string;
  metrics: Metric[];
  published_at: string | null;
}

export default function CommunityFundPublicSection({ communityId, communityName }: { communityId: string; communityName: string }) {
  const [fund, setFund] = useState<Fund | null>(null);
  const [balance, setBalance] = useState(0);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [openReport, setOpenReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: f } = await supabase.from('community_funds').select('*').eq('community_id', communityId).maybeSingle();
      if (f) {
        setFund(f as Fund);
        const { data: cs } = await supabase
          .from('fund_contributions')
          .select('*')
          .eq('fund_id', f.id)
          .order('created_at', { ascending: false });
        if (cs) {
          setBalance(cs.reduce((s, c) => s + Number(c.amount), 0));
          if (f.show_history_publicly) {
            const ids = [...new Set(cs.map(c => c.contributor_id))];
            const { data: profs } = await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', ids);
            const nameMap: Record<string, string> = {};
            profs?.forEach(p => { nameMap[p.user_id] = `${p.first_name} ${p.last_name}`.trim() || 'Anonymous'; });
            setContributions(cs.map(c => ({ ...c, contributor_name: nameMap[c.contributor_id] || 'Anonymous' })) as Contribution[]);
          }
        }
      }
      const { data: rs } = await supabase
        .from('impact_reports')
        .select('*')
        .eq('community_id', communityId)
        .eq('status', 'published')
        .order('published_at', { ascending: false });
      if (rs) setReports(rs.map(r => ({ ...r, metrics: Array.isArray(r.metrics) ? (r.metrics as unknown as Metric[]) : [] })) as Report[]);
      setLoading(false);
    })();
  }, [communityId]);

  if (loading) return null;
  if (!fund && reports.length === 0) return null;

  const target = fund?.target_amount ? Number(fund.target_amount) : null;
  const progress = target ? Math.min(100, (balance / target) * 100) : null;

  return (
    <>
      {fund && (
        <Card className="shadow-card border-primary/30 bg-primary/5">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start gap-3">
              <Heart className="h-6 w-6 text-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-heading font-semibold">{communityName} Community Fund</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{fund.description}</p>
              </div>
            </div>
            <p className="text-sm whitespace-pre-line">{fund.purpose}</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Balance</p>
                <p className="text-2xl font-bold">{formatMoney(balance, fund.currency)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Target</p>
                <p className="text-2xl font-bold">{target ? formatMoney(target, fund.currency) : '—'}</p>
              </div>
            </div>
            {progress !== null && <Progress value={progress} className="h-2" />}
            {fund.show_history_publicly && contributions.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Recent contributions</p>
                <ul className="space-y-1.5 max-h-60 overflow-y-auto">
                  {contributions.map(c => (
                    <li key={c.id} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        {c.source_type === 'provider_pledge'
                          ? <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          : <Users className="h-3.5 w-3.5 text-primary shrink-0" />}
                        <span className="truncate">{c.contributor_name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">· {format(new Date(c.created_at), 'MMM d')}</span>
                      </span>
                      <span className="font-medium">{formatMoney(Number(c.amount), c.currency)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {reports.length > 0 && (
        <div>
          <h2 className="text-lg font-heading font-semibold mb-3 flex items-center gap-2">
            <FileText className="h-5 w-5" /> Impact Reports
          </h2>
          <div className="space-y-3">
            {reports.map(r => (
              <Card key={r.id} className="shadow-card cursor-pointer hover:shadow-card-hover transition-shadow" onClick={() => setOpenReport(r)}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-heading font-semibold">{r.title}</h3>
                    {r.published_at && (
                      <span className="text-xs text-muted-foreground shrink-0">{format(new Date(r.published_at), 'MMM d, yyyy')}</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{r.body}</p>
                  {r.metrics.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {r.metrics.slice(0, 3).map((m, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          <span className="text-muted-foreground mr-1">{m.label}:</span> {m.value}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!openReport} onOpenChange={(o) => !o && setOpenReport(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">{openReport?.title}</DialogTitle>
          </DialogHeader>
          {openReport && (
            <div className="space-y-4">
              {openReport.published_at && (
                <p className="text-xs text-muted-foreground">Published {format(new Date(openReport.published_at), 'MMMM d, yyyy')}</p>
              )}
              <MarkdownPreview content={openReport.body} />
              {openReport.metrics.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-3 border-t">
                  {openReport.metrics.map((m, i) => (
                    <div key={i} className="border rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground">{m.label}</p>
                      <p className="font-semibold">{m.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
