import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { Heart, Info } from 'lucide-react';
import { formatMoney } from '@/lib/pricing';

interface Pledge {
  id: string;
  fund_id: string;
  pledge_percentage: number;
  is_active: boolean;
}

interface CommunityWithFund {
  community_id: string;
  community_name: string;
  fund_id: string;
  fund_currency: string;
  fund_purpose: string;
}

export default function ProviderPledgeSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [hasCommunityWithoutFund, setHasCommunityWithoutFund] = useState(false);
  const [community, setCommunity] = useState<CommunityWithFund | null>(null);
  const [pledge, setPledge] = useState<Pledge | null>(null);
  const [percentage, setPercentage] = useState<number>(5);
  const [totalContributed, setTotalContributed] = useState(0);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setHasCommunityWithoutFund(false);
    const { data: mem } = await supabase
      .from('community_members')
      .select('community_id')
      .eq('provider_id', user.id)
      .eq('status', 'accepted')
      .maybeSingle();
    if (!mem) { setLoading(false); return; }

    const [{ data: comm }, { data: fund }] = await Promise.all([
      supabase.from('communities').select('id, name').eq('id', mem.community_id).maybeSingle(),
      supabase.from('community_funds').select('id, currency, purpose').eq('community_id', mem.community_id).maybeSingle(),
    ]);
    if (!comm) { setLoading(false); return; }
    if (!fund) {
      setHasCommunityWithoutFund(true);
      setLoading(false);
      return;
    }

    setCommunity({
      community_id: comm.id,
      community_name: comm.name,
      fund_id: fund.id,
      fund_currency: fund.currency,
      fund_purpose: fund.purpose,
    });

    const { data: p } = await supabase
      .from('provider_pledges')
      .select('*')
      .eq('provider_id', user.id)
      .eq('fund_id', fund.id)
      .maybeSingle();
    if (p) {
      setPledge(p as Pledge);
      setPercentage(Number(p.pledge_percentage));
    }

    const { data: contribs } = await supabase
      .from('fund_contributions')
      .select('amount')
      .eq('fund_id', fund.id)
      .eq('contributor_id', user.id)
      .eq('source_type', 'provider_pledge');
    if (contribs) setTotalContributed(contribs.reduce((s, c) => s + Number(c.amount), 0));

    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const savePledge = async () => {
    if (!user || !community) return;
    setSaving(true);
    const payload = {
      provider_id: user.id,
      fund_id: community.fund_id,
      pledge_percentage: percentage,
      is_active: true,
    };
    const { error } = pledge
      ? await supabase.from('provider_pledges').update(payload).eq('id', pledge.id)
      : await supabase.from('provider_pledges').insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: 'Error saving pledge', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Pledge saved', description: 'Applies to future bookings only.' });
    setEditing(false);
    load();
  };

  const removePledge = async () => {
    if (!pledge) return;
    const { error } = await supabase.from('provider_pledges').delete().eq('id', pledge.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Pledge removed' });
    setPledge(null); setPercentage(5);
    load();
  };

  if (loading) return null;

  if (hasCommunityWithoutFund) {
    return (
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" /> Community Fund Pledge
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Pledges become available once your community sets up a fund. Check back later or ask your community manager.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!community) return null;

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-primary" /> Community Fund Pledge
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Optionally pledge a percentage of each completed booking to <strong>{community.community_name}</strong>'s fund. By default no portion of your bookings goes to the fund.
        </p>

        {!pledge && !editing && (
          <div className="border rounded-lg p-4 bg-muted/30 text-center space-y-2">
            <p className="text-sm">No pledge — your bookings go entirely to you.</p>
            <Button variant="outline" onClick={() => setEditing(true)}>Set up a pledge</Button>
          </div>
        )}

        {pledge && !editing && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="border rounded-lg p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Current pledge</p>
                <p className="text-2xl font-bold">{Number(pledge.pledge_percentage)}%</p>
              </div>
              <div className="border rounded-lg p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Pledged to date</p>
                <p className="text-2xl font-bold">{formatMoney(totalContributed, community.fund_currency)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={removePledge}>Remove pledge</Button>
            </div>
          </div>
        )}

        {editing && (
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Pledge percentage</span>
                <span className="font-semibold">{percentage}%</span>
              </div>
              <Slider value={[percentage]} onValueChange={([v]) => setPercentage(v)} min={0} max={50} step={1} />
              <p className="text-xs text-muted-foreground mt-1">0–50% of each booking's price.</p>
            </div>
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-2">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>Changes apply to future bookings only — never retroactively. Contributions are recorded automatically when a booking is marked completed.</span>
            </div>
            <div className="flex gap-2">
              <Button onClick={savePledge} disabled={saving}>{saving ? 'Saving…' : 'Save pledge'}</Button>
              <Button variant="ghost" onClick={() => { setEditing(false); if (pledge) setPercentage(Number(pledge.pledge_percentage)); }}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
