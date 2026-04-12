import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MapPin, Clock, Users, DollarSign, Calendar, MessageSquare } from 'lucide-react';
import GoogleMapsProvider from '@/components/GoogleMapsProvider';
import ActivityMap from '@/components/ActivityMap';
import BookingModal from '@/components/BookingModal';
import ReviewsList from '@/components/ReviewsList';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface ActivityData {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  price: number | null;
  currency: string;
  max_participants: number | null;
  start_hour: string | null;
  duration_minutes: number | null;
  recurrence_type: string | null;
  schedule_days: string[] | null;
  event_date: string | null;
  available_from: string | null;
  available_until: string | null;
  interest_tags: string[] | null;
  image_url: string | null;
  provider_id: string;
}

function ActivityDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuth();
  const navigate = useNavigate();
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [providerName, setProviderName] = useState('');
  const [communityName, setCommunityName] = useState<string | null>(null);
  const [communityId, setCommunityId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgText, setMsgText] = useState('');
  const [msgSending, setMsgSending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase.from('activities').select('*').eq('id', id).single();
      if (!data) { navigate(-1); return; }
      setActivity(data as ActivityData);

      const { data: profile } = await supabase.from('profiles').select('first_name, last_name').eq('user_id', data.provider_id).single();
      if (profile) setProviderName(`${profile.first_name} ${profile.last_name}`.trim());

      const { data: membership } = await supabase.from('community_members').select('community_id').eq('provider_id', data.provider_id).eq('status', 'accepted').limit(1).maybeSingle();
      if (membership) {
        setCommunityId(membership.community_id);
        const { data: comm } = await supabase.from('communities').select('name').eq('id', membership.community_id).single();
        if (comm) setCommunityName(comm.name);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!activity) return null;

  const isTraveller = role === 'traveller';

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2 text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-2xl font-heading">{activity.title}</CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>by <Link to={`/dashboard/provider-profile/${activity.provider_id}`} className="text-primary hover:underline">{providerName}</Link></span>
            {communityName && (
              <>
                <span>·</span>
                <Link to={`/dashboard/community/${communityId}`} className="text-primary hover:underline">{communityName}</Link>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {activity.description && <p className="text-foreground">{activity.description}</p>}

          {activity.latitude && activity.longitude && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" /> {activity.location}
              </div>
              <ActivityMap lat={activity.latitude} lng={activity.longitude} className="h-56 w-full rounded-lg overflow-hidden" />
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {activity.price != null && (
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Price</p>
                  <p className="font-medium">{activity.price} {activity.currency}/person</p>
                </div>
              </div>
            )}
            {activity.max_participants && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Capacity</p>
                  <p className="font-medium">{activity.max_participants}</p>
                </div>
              </div>
            )}
            {activity.start_hour && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Start</p>
                  <p className="font-medium">{activity.start_hour}</p>
                </div>
              </div>
            )}
            {activity.duration_minutes && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="font-medium">{activity.duration_minutes} min</p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Schedule</p>
            {activity.recurrence_type === 'one-time' ? (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>One-time event: {activity.event_date || 'Date TBD'}</span>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex flex-wrap gap-1">
                  {activity.schedule_days?.map((day) => (
                    <Badge key={day} variant="outline" className="text-xs">{day}</Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {activity.available_from && `From ${activity.available_from}`}
                  {activity.available_until && ` to ${activity.available_until}`}
                  {!activity.available_until && activity.available_from && ' (open-ended)'}
                </p>
              </div>
            )}
          </div>

          {activity.interest_tags && activity.interest_tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activity.interest_tags.map((tag) => (
                <Badge key={tag} variant="secondary">{tag}</Badge>
              ))}
            </div>
          )}

          <ReviewsList activityId={activity.id} />

          {isTraveller && (
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => setBookingOpen(true)}>
                Book This Activity
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => setMsgOpen(true)}>
                <MessageSquare className="h-4 w-4" /> Message Provider
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Message Provider Modal */}
      <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Message {providerName}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={msgText}
            onChange={e => setMsgText(e.target.value)}
            placeholder={`Ask about "${activity.title}"…`}
            className="min-h-[100px]"
          />
          <Button
            disabled={msgSending || !msgText.trim()}
            onClick={async () => {
              if (!user) return;
              setMsgSending(true);
              const { error } = await supabase.from('messages').insert({
                sender_id: user.id,
                receiver_id: activity.provider_id,
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

      {activity && (
        <BookingModal
          activity={activity}
          open={bookingOpen}
          onOpenChange={setBookingOpen}
          onBooked={() => {
            setTimeout(() => navigate(-1), 1500);
          }}
        />
      )}
    </div>
  );
}

export default function ActivityDetail() {
  return (
    <GoogleMapsProvider>
      <ActivityDetailContent />
    </GoogleMapsProvider>
  );
}
