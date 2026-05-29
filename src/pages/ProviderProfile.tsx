import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { MapPin, DollarSign, Users, MessageSquare, ArrowLeft } from 'lucide-react';

interface Profile {
  first_name: string;
  last_name: string;
  bio: string | null;
  avatar_url: string | null;
  interest_tags: string[] | null;
}

interface Activity {
  id: string;
  title: string;
  location: string | null;
  price: number | null;
  currency: string;
  interest_tags: string[] | null;
}

interface CommunityInfo {
  id: string;
  name: string;
}

export default function ProviderProfile() {
  const { id } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [community, setCommunity] = useState<CommunityInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgText, setMsgText] = useState('');
  const [msgSending, setMsgSending] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [{ data: prof }, { data: acts }, { data: memCommId }] = await Promise.all([
        supabase.from('profiles').select('first_name, last_name, bio, avatar_url, interest_tags').eq('user_id', id).single(),
        supabase.from('activities').select('id, title, location, price, currency, interest_tags').eq('provider_id', id).eq('is_active', true),
        supabase.rpc('get_provider_accepted_community', { _provider_id: id }),
      ]);
      if (prof) setProfile(prof);
      if (acts) setActivities(acts);
      if (memCommId) {
        const { data: comm } = await supabase.from('communities').select('id, name').eq('id', memCommId).single();
        if (comm) setCommunity(comm);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!profile) return <p className="text-center text-muted-foreground py-12">Provider not found.</p>;

  const name = `${profile.first_name} ${profile.last_name}`.trim();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card className="shadow-card">
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-4">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={name} className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-2xl font-bold text-muted-foreground">
                {profile.first_name?.[0]}{profile.last_name?.[0]}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-heading font-bold">{name}</h1>
              {community && (
                <Link to={`/dashboard/community/${community.id}`} className="text-sm text-primary hover:underline flex items-center gap-1">
                  <Users className="h-3 w-3" /> {community.name}
                </Link>
              )}
            </div>
          </div>
          {profile.bio && <p className="text-muted-foreground">{profile.bio}</p>}
          {profile.interest_tags && profile.interest_tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {profile.interest_tags.map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
            </div>
          )}
          {role === 'traveller' && id !== user?.id && (
            <Button variant="outline" className="gap-2" onClick={() => setMsgOpen(true)}>
              <MessageSquare className="h-4 w-4" /> Message Provider
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Message Modal */}
      <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Message {name}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={msgText}
            onChange={e => setMsgText(e.target.value)}
            placeholder="Write your message…"
            className="min-h-[100px]"
          />
          <Button
            disabled={msgSending || !msgText.trim()}
            onClick={async () => {
              if (!user || !id) return;
              setMsgSending(true);
              const { error } = await supabase.from('messages').insert({
                sender_id: user.id,
                receiver_id: id,
                content: msgText.trim(),
              });
              setMsgSending(false);
              if (error) {
                toast({ title: 'Error', description: error.message, variant: 'destructive' });
              } else {
                toast({ title: 'Message sent!' });
                setMsgText('');
                setMsgOpen(false);
              }
            }}
          >
            {msgSending ? 'Sending…' : 'Send Message'}
          </Button>
        </DialogContent>
      </Dialog>

      <div>
        <h2 className="text-lg font-heading font-semibold mb-3">Active Listings ({activities.length})</h2>
        {activities.length === 0 ? (
          <p className="text-muted-foreground text-sm">No active listings.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {activities.map(a => (
              <Link key={a.id} to={`/dashboard/activity/${a.id}`}>
                <Card className="shadow-card hover:shadow-card-hover transition-shadow cursor-pointer h-full">
                  <CardContent className="pt-4 space-y-2">
                    <h3 className="font-heading font-semibold">{a.title}</h3>
                    {a.location && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {a.location}
                      </p>
                    )}
                    {a.price != null && (
                      <span className="text-sm font-medium flex items-center gap-0.5">
                        <DollarSign className="h-3 w-3" /> {a.price} {a.currency}
                      </span>
                    )}
                    {a.interest_tags && a.interest_tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {a.interest_tags.slice(0, 4).map(tag => (
                          <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
