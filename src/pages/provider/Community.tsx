import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Users, Plus, Check, X, ArrowLeft } from 'lucide-react';

interface Community {
  id: string;
  name: string;
  description: string | null;
  manager_id: string;
}

interface Member {
  id: string;
  provider_id: string;
  status: string;
  profiles?: { first_name: string; last_name: string } | null;
}

type View = 'home' | 'create' | 'browse' | 'manage';

export default function CommunityPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [view, setView] = useState<View>('home');
  const [loading, setLoading] = useState(true);

  // My community state
  const [myCommunity, setMyCommunity] = useState<Community | null>(null);
  const [myMembership, setMyMembership] = useState<{ community_id: string; status: string } | null>(null);

  // Manager view
  const [members, setMembers] = useState<Member[]>([]);
  const [pendingMembers, setPendingMembers] = useState<Member[]>([]);

  // Create form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Browse
  const [allCommunities, setAllCommunities] = useState<Community[]>([]);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  // Community metrics
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [totalBookings, setTotalBookings] = useState(0);

  useEffect(() => {
    if (!myCommunity || view !== 'manage') return;
    (async () => {
      const providerIds = members.map(m => m.provider_id);
      if (providerIds.length === 0) return;
      const { data: acts } = await supabase.from('activities').select('id').in('provider_id', providerIds);
      const actIds = acts?.map(a => a.id) || [];
      if (actIds.length === 0) return;
      const { count } = await supabase.from('bookings').select('id', { count: 'exact', head: true }).in('activity_id', actIds);
      setTotalBookings(count || 0);
      const { data: reviews } = await supabase.from('reviews').select('rating').in('activity_id', actIds);
      if (reviews && reviews.length > 0) {
        setAvgRating(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length);
      }
    })();
  }, [myCommunity, members, view]);

  const fetchMyStatus = async () => {
    if (!user) return;
    setLoading(true);

    // Check if I manage a community
    const { data: managed } = await supabase
      .from('communities')
      .select('*')
      .eq('manager_id', user.id)
      .maybeSingle();

    if (managed) {
      setMyCommunity(managed);
      setView('manage');
      // Fetch members
      const { data: mems } = await supabase
        .from('community_members')
        .select('id, provider_id, status')
        .eq('community_id', managed.id);
      if (mems) {
        // Fetch profile names for members
        const providerIds = mems.map(m => m.provider_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', providerIds);
        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
        const enriched = mems.map(m => ({
          ...m,
          profiles: profileMap.get(m.provider_id) || null,
        }));
        setMembers(enriched.filter(m => m.status === 'accepted'));
        setPendingMembers(enriched.filter(m => m.status === 'pending'));
      }
      setLoading(false);
      return;
    }

    // Check if I'm a member of a community
    const { data: membership } = await supabase
      .from('community_members')
      .select('community_id, status')
      .eq('provider_id', user.id)
      .maybeSingle();

    if (membership) {
      setMyMembership(membership);
      const { data: comm } = await supabase
        .from('communities')
        .select('*')
        .eq('id', membership.community_id)
        .single();
      if (comm) setMyCommunity(comm);
    }

    setLoading(false);
  };

  useEffect(() => { fetchMyStatus(); }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCreating(true);
    const { data, error } = await supabase
      .from('communities')
      .insert({ name, description: description || null, manager_id: user.id })
      .select()
      .single();
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setCreating(false);
      return;
    }
    // Auto-add as accepted member
    await supabase.from('community_members').insert({
      community_id: data.id,
      provider_id: user.id,
      status: 'accepted',
    });
    toast({ title: 'Community created!' });
    setCreating(false);
    fetchMyStatus();
  };

  const handleBrowse = async () => {
    setView('browse');
    const { data } = await supabase.from('communities').select('*').order('created_at', { ascending: false });
    if (data) setAllCommunities(data);
  };

  const handleJoin = async (communityId: string) => {
    if (!user) return;
    setJoiningId(communityId);
    const { error } = await supabase.from('community_members').insert({
      community_id: communityId,
      provider_id: user.id,
      status: 'pending',
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Join request sent!' });
      setMyMembership({ community_id: communityId, status: 'pending' });
    }
    setJoiningId(null);
  };

  const handleMemberAction = async (memberId: string, action: 'accepted' | 'rejected') => {
    const { error } = await supabase
      .from('community_members')
      .update({ status: action })
      .eq('id', memberId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: action === 'accepted' ? 'Member accepted!' : 'Request rejected' });
      fetchMyStatus();
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  // Community metrics
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [totalBookings, setTotalBookings] = useState(0);

  useEffect(() => {
    if (!myCommunity || view !== 'manage') return;
    (async () => {
      // Get all member provider_ids
      const providerIds = members.map(m => m.provider_id);
      if (providerIds.length === 0) return;

      // Get all activities by these providers
      const { data: acts } = await supabase.from('activities').select('id').in('provider_id', providerIds);
      const actIds = acts?.map(a => a.id) || [];
      if (actIds.length === 0) return;

      // Count bookings
      const { count } = await supabase.from('bookings').select('id', { count: 'exact', head: true }).in('activity_id', actIds);
      setTotalBookings(count || 0);

      // Avg review score
      const { data: reviews } = await supabase.from('reviews').select('rating').in('activity_id', actIds);
      if (reviews && reviews.length > 0) {
        setAvgRating(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length);
      }
    })();
  }, [myCommunity, members, view]);

  // Manager view
  if (view === 'manage' && myCommunity) {
    return (
      <div>
        <h1 className="text-2xl font-heading font-bold mb-2">{myCommunity.name}</h1>
        {myCommunity.description && <p className="text-muted-foreground mb-6">{myCommunity.description}</p>}

        {/* Aggregate metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <Card className="shadow-card">
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold">{members.length}</p>
              <p className="text-xs text-muted-foreground">Members</p>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold">{totalBookings}</p>
              <p className="text-xs text-muted-foreground">Total Bookings</p>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold">{avgRating != null ? avgRating.toFixed(1) : '—'}</p>
              <p className="text-xs text-muted-foreground">Avg Rating</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="shadow-card">
            <CardHeader><CardTitle className="text-lg">Members ({members.length})</CardTitle></CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <p className="text-muted-foreground text-sm">No members yet.</p>
              ) : (
                <ul className="space-y-2">
                  {members.map((m) => (
                    <li key={m.id} className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{m.profiles ? `${m.profiles.first_name} ${m.profiles.last_name}` : 'Unknown'}</span>
                      {m.provider_id === myCommunity.manager_id && <Badge variant="secondary" className="text-xs">Manager</Badge>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader><CardTitle className="text-lg">Pending Requests ({pendingMembers.length})</CardTitle></CardHeader>
            <CardContent>
              {pendingMembers.length === 0 ? (
                <p className="text-muted-foreground text-sm">No pending requests.</p>
              ) : (
                <ul className="space-y-3">
                  {pendingMembers.map((m) => (
                    <li key={m.id} className="flex items-center justify-between">
                      <span className="text-sm">{m.profiles ? `${m.profiles.first_name} ${m.profiles.last_name}` : 'Unknown'}</span>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="gap-1 text-primary" onClick={() => handleMemberAction(m.id, 'accepted')}>
                          <Check className="h-3 w-3" /> Accept
                        </Button>
                        <Button size="sm" variant="ghost" className="gap-1 text-destructive" onClick={() => handleMemberAction(m.id, 'rejected')}>
                          <X className="h-3 w-3" /> Reject
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Member view (not manager)
  if (myMembership && myCommunity) {
    return (
      <div>
        <h1 className="text-2xl font-heading font-bold mb-6">Community</h1>
        <Card className="shadow-card">
          <CardHeader><CardTitle>{myCommunity.name}</CardTitle></CardHeader>
          <CardContent>
            {myCommunity.description && <p className="text-muted-foreground mb-3">{myCommunity.description}</p>}
            <Badge variant={myMembership.status === 'accepted' ? 'default' : 'secondary'}>
              {myMembership.status === 'accepted' ? 'Member' : 'Pending approval'}
            </Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Create form
  if (view === 'create') {
    return (
      <div className="max-w-lg mx-auto">
        <Button variant="ghost" onClick={() => setView('home')} className="mb-4 gap-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Card className="shadow-card">
          <CardHeader><CardTitle className="font-heading">Create a Community</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cname">Community Name *</Label>
                <Input id="cname" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kyoto Cultural Providers" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cdesc">Description</Label>
                <Textarea id="cdesc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this community about?" />
              </div>
              <Button type="submit" className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground" disabled={creating}>
                {creating ? 'Creating…' : 'Create Community'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Browse view
  if (view === 'browse') {
    return (
      <div>
        <Button variant="ghost" onClick={() => setView('home')} className="mb-4 gap-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <h1 className="text-2xl font-heading font-bold mb-6">Browse Communities</h1>
        {allCommunities.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No communities yet. Be the first to create one!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {allCommunities.map((c) => (
              <Card key={c.id} className="shadow-card">
                <CardHeader><CardTitle className="text-lg">{c.name}</CardTitle></CardHeader>
                <CardContent>
                  {c.description && <p className="text-sm text-muted-foreground mb-3">{c.description}</p>}
                  {c.manager_id === user?.id ? (
                    <Badge>Your Community</Badge>
                  ) : myMembership?.community_id === c.id ? (
                    <Badge variant="secondary">{myMembership.status === 'accepted' ? 'Member' : 'Pending'}</Badge>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => handleJoin(c.id)} disabled={joiningId === c.id}>
                      {joiningId === c.id ? 'Sending…' : 'Request to Join'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Home — no community yet
  return (
    <div>
      <h1 className="text-2xl font-heading font-bold mb-6">Community</h1>
      <div className="grid gap-4 md:grid-cols-2 max-w-2xl">
        <Card className="shadow-card hover:shadow-card-hover transition-shadow cursor-pointer" onClick={() => setView('create')}>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Plus className="h-10 w-10 text-primary mb-3" />
            <h3 className="text-lg font-semibold mb-1">Create a Community</h3>
            <p className="text-sm text-muted-foreground">Start your own provider community</p>
          </CardContent>
        </Card>
        <Card className="shadow-card hover:shadow-card-hover transition-shadow cursor-pointer" onClick={handleBrowse}>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-10 w-10 text-primary mb-3" />
            <h3 className="text-lg font-semibold mb-1">Browse Communities</h3>
            <p className="text-sm text-muted-foreground">Find and join an existing community</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
