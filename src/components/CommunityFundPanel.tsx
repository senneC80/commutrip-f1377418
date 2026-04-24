import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Heart, Plus, Trash2, Pencil, Users, User } from 'lucide-react';
import { formatMoney } from '@/lib/pricing';
import { format } from 'date-fns';

interface Fund {
  id: string;
  community_id: string;
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

export default function CommunityFundPanel({ communityId }: { communityId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [fund, setFund] = useState<Fund | null>(null);
  const [loading, setLoading] = useState(true);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [editing, setEditing] = useState(false);

  // Form
  const [description, setDescription] = useState('');
  const [purpose, setPurpose] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [showHistoryPublicly, setShowHistoryPublicly] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadFund = async () => {
    setLoading(true);
    const { data } = await supabase.from('community_funds').select('*').eq('community_id', communityId).maybeSingle();
    if (data) {
      setFund(data as Fund);
      setDescription(data.description);
      setPurpose(data.purpose);
      setTargetAmount(data.target_amount ? String(data.target_amount) : '');
      setShowHistoryPublicly(data.show_history_publicly);
      // Load contributions
      const { data: cs } = await supabase
        .from('fund_contributions')
        .select('*')
        .eq('fund_id', data.id)
        .order('created_at', { ascending: false });
      if (cs) {
        const contributorIds = [...new Set(cs.map(c => c.contributor_id))];
        const { data: profs } = await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', contributorIds);
        const nameMap: Record<string, string> = {};
        profs?.forEach(p => { nameMap[p.user_id] = `${p.first_name} ${p.last_name}`.trim() || 'Unknown'; });
        setContributions(cs.map(c => ({ ...c, contributor_name: nameMap[c.contributor_id] || 'Unknown' })) as Contribution[]);
      }
    } else {
      setFund(null);
      setContributions([]);
    }
    setLoading(false);
  };

  useEffect(() => { loadFund(); }, [communityId]);

  const handleSave = async () => {
    if (!user) return;
    if (!description.trim() || !purpose.trim()) {
      toast({ title: 'Description and purpose are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      community_id: communityId,
      description: description.trim(),
      purpose: purpose.trim(),
      target_amount: targetAmount ? parseFloat(targetAmount) : null,
      show_history_publicly: showHistoryPublicly,
    };
    const { error } = fund
      ? await supabase.from('community_funds').update(payload).eq('id', fund.id)
      : await supabase.from('community_funds').insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: 'Error saving fund', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: fund ? 'Fund updated' : 'Fund created!' });
    setEditing(false);
    loadFund();
  };

  const handleDelete = async () => {
    if (!fund) return;
    const { error } = await supabase.from('community_funds').delete().eq('id', fund.id);
    if (error) {
      toast({ title: 'Error deleting fund', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Fund deleted' });
    setFund(null);
  };

  if (loading) return <div className="flex items-center justify-center h-32"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" /></div>;

  // Empty state
  if (!fund && !editing) {
    return (
      <Card className="shadow-card">
        <CardContent className="flex flex-col items-center text-center py-12">
          <Heart className="h-10 w-10 text-primary mb-3" />
          <h3 className="text-lg font-semibold mb-1">Set up a Community Fund</h3>
          <p className="text-sm text-muted-foreground max-w-md mb-4">
            Optionally create a shared fund so providers can pledge a portion of bookings, and travellers can leave voluntary contributions. Income to providers is unaffected by default.
          </p>
          <Button onClick={() => setEditing(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Set up Community Fund
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Edit / create form
  if (editing) {
    return (
      <Card className="shadow-card">
        <CardHeader><CardTitle>{fund ? 'Edit Community Fund' : 'Set up Community Fund'}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Description *</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this fund?" maxLength={500} />
          </div>
          <div className="space-y-2">
            <Label>Purpose *</Label>
            <Textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="What will the money support?" maxLength={2000} />
          </div>
          <div className="space-y-2">
            <Label>Target amount (optional)</Label>
            <Input type="number" min={0} step="100" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} placeholder="e.g. 10000" />
          </div>
          <div className="flex items-center justify-between border rounded-lg p-3">
            <div>
              <p className="text-sm font-medium">Show contribution history publicly</p>
              <p className="text-xs text-muted-foreground">The balance is always public. This toggle controls whether the contribution list appears on the public community page.</p>
            </div>
            <Switch checked={showHistoryPublicly} onCheckedChange={setShowHistoryPublicly} />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            <Button variant="ghost" onClick={() => { setEditing(false); if (!fund) return; setDescription(fund.description); setPurpose(fund.purpose); }}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Fund overview + contributions
  const balance = contributions.reduce((s, c) => s + Number(c.amount), 0);
  const target = fund!.target_amount ? Number(fund!.target_amount) : null;
  const progress = target ? Math.min(100, (balance / target) * 100) : null;

  return (
    <div className="space-y-4">
      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2"><Heart className="h-5 w-5 text-primary" /> Community Fund</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{fund!.description}</p>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /></Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete the Community Fund?</AlertDialogTitle>
                  <AlertDialogDescription>This permanently removes the fund and all its contribution records. This cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete fund</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Purpose</p>
            <p className="text-sm whitespace-pre-line">{fund!.purpose}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Balance</p>
              <p className="text-2xl font-bold">{formatMoney(balance, fund!.currency)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Target</p>
              <p className="text-2xl font-bold">{target ? formatMoney(target, fund!.currency) : '—'}</p>
            </div>
          </div>
          {progress !== null && <Progress value={progress} className="h-2" />}
          <div className="text-xs text-muted-foreground">
            Contribution history is currently <strong>{fund!.show_history_publicly ? 'public' : 'private'}</strong> on the community page.
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader><CardTitle className="text-lg">Contributions ({contributions.length})</CardTitle></CardHeader>
        <CardContent>
          {contributions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contributions yet.</p>
          ) : (
            <ul className="space-y-2">
              {contributions.map(c => (
                <li key={c.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {c.source_type === 'provider_pledge'
                      ? <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      : <Users className="h-4 w-4 text-primary shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.contributor_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.source_type === 'provider_pledge' ? 'Provider pledge' : 'Traveller top-up'} · {format(new Date(c.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  <span className="font-semibold">{formatMoney(Number(c.amount), c.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
