import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, ShieldAlert, Clock, ShieldQuestion } from 'lucide-react';
import VerifiedBadge from '@/components/VerifiedBadge';

interface Verification {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewer_notes: string | null;
  decided_at: string | null;
  ownership_type: string;
  revenue_distribution: string;
  certifications: string | null;
  narrative: string;
}

const OWNERSHIP_OPTIONS: { value: string; label: string }[] = [
  { value: 'cooperative', label: 'Cooperative' },
  { value: 'local_ngo', label: 'Local NGO' },
  { value: 'village_association', label: 'Village / community association' },
  { value: 'family_owned', label: 'Family-owned' },
  { value: 'other', label: 'Other' },
];

interface Props { communityId: string }

export default function CommunityVerificationPanel({ communityId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [ownershipType, setOwnershipType] = useState('');
  const [revenue, setRevenue] = useState('');
  const [certs, setCerts] = useState('');
  const [narrative, setNarrative] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchSubs = async () => {
    const { data } = await supabase
      .from('community_verifications')
      .select('id, status, reviewer_notes, decided_at, ownership_type, revenue_distribution, certifications, narrative')
      .eq('community_id', communityId)
      .order('created_at', { ascending: false });
    setSubmissions((data || []) as Verification[]);
    setLoading(false);
  };

  useEffect(() => { fetchSubs(); }, [communityId]);

  const latest = submissions[0];
  const approved = submissions.find(s => s.status === 'approved');
  const pending = submissions.find(s => s.status === 'pending');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !ownershipType || !revenue.trim() || !narrative.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from('community_verifications').insert({
      community_id: communityId,
      submitter_id: user.id,
      ownership_type: ownershipType,
      revenue_distribution: revenue.trim(),
      certifications: certs.trim() || null,
      narrative: narrative.trim(),
    });
    setSubmitting(false);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Submitted for review' });
    setShowForm(false);
    setOwnershipType(''); setRevenue(''); setCerts(''); setNarrative('');
    fetchSubs();
  };

  if (loading) return null;

  // Verified state (always wins)
  if (approved) {
    return (
      <Card className="shadow-card border-primary/30">
        <CardContent className="py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold">CBT Verified</p>
                <VerifiedBadge size="sm" />
              </div>
              <p className="text-xs text-muted-foreground">Approved {approved.decided_at ? new Date(approved.decided_at).toLocaleDateString() : ''}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Pending state
  if (pending) {
    return (
      <Card className="shadow-card border-secondary">
        <CardContent className="py-4 flex items-center gap-3">
          <Clock className="h-6 w-6 text-muted-foreground" />
          <div>
            <p className="font-semibold">Pending Review</p>
            <p className="text-xs text-muted-foreground">Your CBT verification submission is awaiting review.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Form open
  if (showForm) {
    const wasRejected = latest?.status === 'rejected';
    return (
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldQuestion className="h-5 w-5 text-primary" />
            {wasRejected ? 'Resubmit for CBT Verification' : 'Request CBT Verification'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>Ownership type *</Label>
              <Select value={ownershipType} onValueChange={setOwnershipType}>
                <SelectTrigger><SelectValue placeholder="Select ownership type" /></SelectTrigger>
                <SelectContent>
                  {OWNERSHIP_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="rev">How is tourism revenue distributed? *</Label>
              <Textarea id="rev" rows={3} value={revenue} onChange={e => setRevenue(e.target.value)}
                placeholder="e.g. Revenue is split equally among member households, with 10% reinvested in community projects." required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="certs">Existing certifications or partnerships</Label>
              <Textarea id="certs" rows={2} value={certs} onChange={e => setCerts(e.target.value)}
                placeholder="Optional. List any official recognitions, NGO partners, certifications…" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="narr">CBT narrative *</Label>
              <Textarea id="narr" rows={5} value={narrative} onChange={e => setNarrative(e.target.value)}
                placeholder="Tell us how your community formed, who runs it, and why your offering qualifies as community-based tourism." required />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)} disabled={submitting}>Cancel</Button>
              <Button type="submit" disabled={submitting || !ownershipType}>{submitting ? 'Submitting…' : 'Submit for Review'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  // Rejected — show notes + resubmit
  if (latest?.status === 'rejected') {
    return (
      <Card className="shadow-card border-destructive/40">
        <CardContent className="py-4 space-y-3">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-destructive" />
            <div className="flex-1">
              <p className="font-semibold">Verification rejected</p>
              <p className="text-xs text-muted-foreground">Decided {latest.decided_at ? new Date(latest.decided_at).toLocaleDateString() : ''}</p>
            </div>
            <Badge variant="destructive">Rejected</Badge>
          </div>
          {latest.reviewer_notes && (
            <div className="text-sm bg-muted/50 rounded-md p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Reviewer notes</p>
              <p className="whitespace-pre-wrap">{latest.reviewer_notes}</p>
            </div>
          )}
          <Button onClick={() => setShowForm(true)} size="sm">Resubmit</Button>
        </CardContent>
      </Card>
    );
  }

  // Unverified — never submitted
  return (
    <Card className="shadow-card border-dashed">
      <CardContent className="py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ShieldQuestion className="h-6 w-6 text-muted-foreground" />
          <div>
            <p className="font-semibold">Not yet verified</p>
            <p className="text-xs text-muted-foreground">Apply for CBT verification to display a trusted badge to travellers.</p>
          </div>
        </div>
        <Button onClick={() => setShowForm(true)} size="sm">Request CBT Verification</Button>
      </CardContent>
    </Card>
  );
}
