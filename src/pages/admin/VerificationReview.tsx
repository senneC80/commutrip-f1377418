import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Check, X, MapPin, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const OWNERSHIP_LABELS: Record<string, string> = {
  cooperative: 'Cooperative',
  local_ngo: 'Local NGO',
  village_association: 'Village / community association',
  family_owned: 'Family-owned',
  other: 'Other',
};

export default function VerificationReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [submission, setSubmission] = useState<any>(null);
  const [community, setCommunity] = useState<any>(null);
  const [submitter, setSubmitter] = useState<string>('');
  const [manager, setManager] = useState<string>('');
  const [members, setMembers] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: sub } = await supabase.from('community_verifications').select('*').eq('id', id).single();
      if (!sub) { setLoading(false); return; }
      setSubmission(sub);

      const { data: comm } = await supabase.from('communities').select('*').eq('id', sub.community_id).single();
      setCommunity(comm);

      const [{ data: subProf }, { data: mgrProf }] = await Promise.all([
        supabase.from('profiles').select('first_name, last_name').eq('user_id', sub.submitter_id).maybeSingle(),
        comm ? supabase.from('profiles').select('first_name, last_name').eq('user_id', comm.manager_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      if (subProf) setSubmitter(`${subProf.first_name} ${subProf.last_name}`.trim());
      if (mgrProf) setManager(`${mgrProf.first_name} ${mgrProf.last_name}`.trim());

      if (comm) {
        const { data: mems } = await supabase.rpc('get_accepted_community_members', { _community_id: comm.id });
        const providerIds = (mems || []).map((m: any) => m.provider_id);
        if (providerIds.length > 0) {
          const [{ data: profs }, { data: acts }] = await Promise.all([
            supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', providerIds),
            supabase.from('activities').select('id, title, location, price, currency').eq('is_active', true).in('provider_id', providerIds),
          ]);
          setMembers(profs || []);
          setActivities(acts || []);
        }
      }
      setLoading(false);
    })();
  }, [id]);

  const decide = async (decision: 'approved' | 'rejected') => {
    if (!notes.trim()) {
      toast({ title: 'Reviewer notes required', description: 'Please add notes explaining your decision.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('community_verifications')
      .update({
        status: decision,
        reviewer_notes: notes.trim(),
        reviewer_id: user!.id,
        decided_at: new Date().toISOString(),
      })
      .eq('id', id!);
    setSaving(false);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: decision === 'approved' ? 'Community verified' : 'Submission rejected' });
    navigate('/admin');
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!submission || !community) return <p className="text-muted-foreground py-12 text-center">Submission not found.</p>;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <Button variant="ghost" onClick={() => navigate('/admin')} className="gap-2 text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to queue
      </Button>

      {/* Community profile */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-xl font-heading flex items-center gap-2">{community.name}</CardTitle>
          <p className="text-sm text-muted-foreground">Manager: {manager || '—'}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {community.description && <p className="text-sm">{community.description}</p>}

          <div>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Members ({members.length})</h4>
            {members.length === 0 ? <p className="text-xs text-muted-foreground">No accepted members.</p> : (
              <div className="flex flex-wrap gap-1">
                {members.map(m => <Badge key={m.user_id} variant="outline">{m.first_name} {m.last_name}</Badge>)}
              </div>
            )}
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Active Listings ({activities.length})</h4>
            {activities.length === 0 ? <p className="text-xs text-muted-foreground">No active listings.</p> : (
              <ul className="space-y-1.5">
                {activities.map(a => (
                  <li key={a.id} className="text-sm flex items-center justify-between border-b border-border/40 pb-1.5 last:border-0">
                    <Link to={`/dashboard/activity/${a.id}`} target="_blank" className="hover:underline">{a.title}</Link>
                    <span className="text-xs text-muted-foreground flex items-center gap-2">
                      {a.location && <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{a.location}</span>}
                      {a.price != null && <span className="flex items-center gap-0.5"><DollarSign className="h-3 w-3" />{a.price} {a.currency}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Submission details */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg font-heading">Submission</CardTitle>
          <p className="text-xs text-muted-foreground">By {submitter || '—'} on {new Date(submission.created_at).toLocaleDateString()}</p>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Ownership type</p>
            <p>{OWNERSHIP_LABELS[submission.ownership_type] || submission.ownership_type}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Revenue distribution</p>
            <p className="whitespace-pre-wrap">{submission.revenue_distribution}</p>
          </div>
          {submission.certifications && (
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Certifications / partnerships</p>
              <p className="whitespace-pre-wrap">{submission.certifications}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">CBT narrative</p>
            <p className="whitespace-pre-wrap">{submission.narrative}</p>
          </div>
        </CardContent>
      </Card>

      {/* Decision */}
      <Card className="shadow-card">
        <CardHeader><CardTitle className="text-lg font-heading">Decision</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="notes">Reviewer notes <span className="text-destructive">*</span></Label>
            <Textarea id="notes" rows={4} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Required. Explain your reasoning — visible to the community manager." />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" className="gap-1 text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => decide('rejected')} disabled={saving}>
              <X className="h-4 w-4" /> Reject
            </Button>
            <Button className="gap-1" onClick={() => decide('approved')} disabled={saving}>
              <Check className="h-4 w-4" /> Approve
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
