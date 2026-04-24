import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MapPin, Calendar, DollarSign, ChevronDown, Star, Check } from 'lucide-react';
import GoogleMapsProvider from '@/components/GoogleMapsProvider';
import TripMap from '@/components/TripMap';
import ReviewForm from '@/components/ReviewForm';
import TripImpactSummary from '@/components/TripImpactSummary';

interface TripStop {
  id: string;
  location_name: string;
  latitude: number | null;
  longitude: number | null;
  arrival_date: string | null;
  departure_date: string | null;
  order_index: number;
}

interface Activity {
  id: string;
  title: string;
  location: string | null;
  price: number | null;
  currency: string;
  interest_tags: string[] | null;
  provider_id: string;
  distance_km: number;
  tag_match_count: number;
  provider_name?: string;
  community_name?: string;
}

interface BookedActivity {
  booking_id: string;
  activity_id: string;
  title: string;
  location: string | null;
  booking_date: string;
  participants: number;
  total_price: number | null;
  status: string;
  provider_id: string;
  has_review: boolean;
  review_rating?: number;
}

const INITIAL_SHOW = 3;

function StopRecommendations({ activities }: { activities: Activity[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? activities : activities.slice(0, INITIAL_SHOW);
  const hasMore = activities.length > INITIAL_SHOW;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">Recommended Activities</p>
      {visible.map((act) => (
        <Link key={act.id} to={`/dashboard/activity/${act.id}`} className="block">
          <div className="border rounded-lg p-3 hover:shadow-card-hover transition-shadow cursor-pointer">
            <div className="flex justify-between items-start">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">{act.title}</p>
                <p className="text-xs text-muted-foreground">{act.provider_name}{act.community_name ? ` · ${act.community_name}` : ''}</p>
              </div>
              {act.price != null && (
                <span className="text-sm font-semibold flex items-center gap-0.5 shrink-0 ml-2">
                  <DollarSign className="h-3 w-3" />{act.price}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{act.location || 'Unknown location'}</span>
              <span className="shrink-0">· {act.distance_km < 1 ? `${Math.round(act.distance_km * 1000)}m` : `${act.distance_km.toFixed(1)}km`}</span>
            </div>
            {act.interest_tags && act.interest_tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {act.interest_tags.slice(0, 4).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                ))}
              </div>
            )}
          </div>
        </Link>
      ))}
      {hasMore && !expanded && (
        <Button variant="ghost" size="sm" className="w-full text-xs gap-1" onClick={() => setExpanded(true)}>
          <ChevronDown className="h-3 w-3" />
          Show {activities.length - INITIAL_SHOW} more
        </Button>
      )}
    </div>
  );
}

function BookedActivityCard({ booking, activityTitle, onReviewSubmitted }: {
  booking: BookedActivity;
  activityTitle: string;
  onReviewSubmitted: () => void;
}) {
  const { user } = useAuth();
  const [reviewOpen, setReviewOpen] = useState(false);
  const isPast = new Date(booking.booking_date) < new Date();
  const canReview = isPast && !booking.has_review;

  return (
    <>
      <div className="border-2 border-primary/30 bg-primary/5 rounded-lg p-3">
        <div className="flex justify-between items-start">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm">{activityTitle}</p>
              <Badge className="text-[10px] px-1.5 py-0"><Check className="h-2.5 w-2.5 mr-0.5" />Booked</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {booking.booking_date} · {booking.participants} participant{booking.participants > 1 ? 's' : ''}
            </p>
          </div>
          {booking.total_price != null && (
            <span className="text-sm font-semibold flex items-center gap-0.5 shrink-0 ml-2">
              <DollarSign className="h-3 w-3" />{booking.total_price}
            </span>
          )}
        </div>
        {booking.has_review && booking.review_rating && (
          <div className="flex items-center gap-1 mt-1.5 text-xs">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            <span>{booking.review_rating}/5</span>
            <span className="text-muted-foreground">Reviewed</span>
          </div>
        )}
        {canReview && (
          <Button variant="outline" size="sm" className="mt-2 text-xs h-7" onClick={() => setReviewOpen(true)}>
            Leave Review
          </Button>
        )}
      </div>
      {user && (
        <ReviewForm
          bookingId={booking.booking_id}
          activityId={booking.activity_id}
          activityTitle={activityTitle}
          travellerId={user.id}
          providerId={booking.provider_id}
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          onReviewed={onReviewSubmitted}
        />
      )}
    </>
  );
}

function TripDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<any>(null);
  const [stops, setStops] = useState<TripStop[]>([]);
  const [recommendations, setRecommendations] = useState<Record<string, Activity[]>>({});
  const [bookedByStop, setBookedByStop] = useState<Record<string, BookedActivity[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const { data: tripData } = await supabase.from('trips').select('*').eq('id', id).eq('user_id', user.id).single();
      if (!tripData) { navigate('/dashboard'); return; }
      setTrip(tripData);

      const { data: stopsData } = await supabase.from('trip_stops').select('*').eq('trip_id', id).order('order_index');
      setStops(stopsData || []);
      setLoading(false);

      // Fetch traveller's bookings
      const { data: myBookings } = await supabase
        .from('bookings')
        .select('id, activity_id, booking_date, participants, total_price, status, provider_id')
        .eq('traveller_id', user.id);

      // Fetch reviews for these bookings
      const bookingIds = myBookings?.map(b => b.id) || [];
      let reviewMap: Record<string, number> = {};
      if (bookingIds.length > 0) {
        const { data: reviews } = await supabase.from('reviews').select('booking_id, rating').in('booking_id', bookingIds);
        reviews?.forEach(r => { reviewMap[r.booking_id] = r.rating; });
      }

      // Get activity details for booked activities
      const bookedActIds = [...new Set(myBookings?.map(b => b.activity_id) || [])];
      let activityMap: Record<string, { title: string; location: string | null; latitude: number | null; longitude: number | null }> = {};
      if (bookedActIds.length > 0) {
        const { data: acts } = await supabase.from('activities').select('id, title, location, latitude, longitude').in('id', bookedActIds);
        acts?.forEach(a => { activityMap[a.id] = a; });
      }

      // Match bookings to stops by proximity
      const stopBookings: Record<string, BookedActivity[]> = {};
      for (const stop of stopsData || []) {
        if (!stop.latitude || !stop.longitude) continue;
        const matched: BookedActivity[] = [];
        for (const b of myBookings || []) {
          const act = activityMap[b.activity_id];
          if (!act || !act.latitude || !act.longitude) continue;
          // Simple distance check (< 50km)
          const dlat = act.latitude - stop.latitude;
          const dlng = act.longitude - stop.longitude;
          const approxKm = Math.sqrt(dlat * dlat + dlng * dlng) * 111;
          if (approxKm < 50) {
            matched.push({
              booking_id: b.id,
              activity_id: b.activity_id,
              title: act.title,
              location: act.location,
              booking_date: b.booking_date,
              participants: b.participants,
              total_price: b.total_price,
              status: b.status,
              provider_id: b.provider_id,
              has_review: !!reviewMap[b.id],
              review_rating: reviewMap[b.id],
            });
          }
        }
        if (matched.length > 0) stopBookings[stop.id] = matched;
      }
      setBookedByStop(stopBookings);

      // Fetch recommendations
      const travTags = profile?.interest_tags || [];
      const recs: Record<string, Activity[]> = {};
      for (const stop of stopsData || []) {
        if (!stop.latitude || !stop.longitude) continue;
        const { data } = await supabase.rpc('get_recommended_activities', {
          _stop_lat: stop.latitude,
          _stop_lng: stop.longitude,
          _arrival_date: stop.arrival_date || '2020-01-01',
          _departure_date: stop.departure_date || '2030-12-31',
          _traveller_tags: travTags,
        });
        if (data && data.length > 0) {
          const providerIds = [...new Set(data.map((a: any) => a.provider_id))];
          const { data: profiles } = await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', providerIds);
          const { data: members } = await supabase.from('community_members').select('provider_id, community_id, status').in('provider_id', providerIds).eq('status', 'accepted');
          let communityMap: Record<string, string> = {};
          if (members && members.length > 0) {
            const communityIds = [...new Set(members.map((m: any) => m.community_id))];
            const { data: communities } = await supabase.from('communities').select('id, name').in('id', communityIds);
            const cMap: Record<string, string> = {};
            communities?.forEach((c: any) => { cMap[c.id] = c.name; });
            members.forEach((m: any) => { communityMap[m.provider_id] = cMap[m.community_id] || ''; });
          }
          const profileMap: Record<string, string> = {};
          profiles?.forEach((p: any) => { profileMap[p.user_id] = `${p.first_name} ${p.last_name}`.trim(); });

          recs[stop.id] = data.map((a: any) => ({
            ...a,
            provider_name: profileMap[a.provider_id] || 'Provider',
            community_name: communityMap[a.provider_id] || undefined,
          }));
        }
      }
      setRecommendations(recs);
    })();
  }, [id, user, refreshKey]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!trip) return null;

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={() => navigate('/dashboard')} className="gap-2 text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to My Trips
      </Button>
      <h1 className="text-2xl font-heading font-bold">{trip.title}</h1>
      {trip.description && <p className="text-muted-foreground">{trip.description}</p>}

      {user && (
        <TripImpactSummary
          travellerId={user.id}
          activityIds={Object.values(bookedByStop).flat().map(b => b.activity_id)}
        />
      )}

      <div className="flex gap-6 items-start">
        <div className="w-[420px] shrink-0 space-y-4 max-h-[calc(100vh-180px)] overflow-y-auto pr-2">
          {stops.length === 0 && <p className="text-muted-foreground">No stops added to this trip yet.</p>}
          {stops.map((stop, i) => (
            <Card key={stop.id} className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  {stop.location_name}
                </CardTitle>
                {(stop.arrival_date || stop.departure_date) && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {stop.arrival_date || '?'} → {stop.departure_date || '?'}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Booked activities */}
                {bookedByStop[stop.id] && bookedByStop[stop.id].length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-primary">Your Bookings</p>
                    {bookedByStop[stop.id].map((b) => (
                      <BookedActivityCard
                        key={b.booking_id}
                        booking={b}
                        activityTitle={b.title}
                        onReviewSubmitted={() => setRefreshKey(k => k + 1)}
                      />
                    ))}
                  </div>
                )}

                {/* Recommendations */}
                {recommendations[stop.id] && recommendations[stop.id].length > 0 ? (
                  <StopRecommendations activities={recommendations[stop.id]} />
                ) : (
                  <p className="text-sm text-muted-foreground">No activities found near this stop.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex-1 min-w-0 sticky top-4">
          <TripMap stops={stops} className="h-[calc(100vh-180px)] w-full rounded-lg overflow-hidden shadow-card" />
        </div>
      </div>
    </div>
  );
}

export default function TripDetail() {
  return (
    <GoogleMapsProvider>
      <TripDetailContent />
    </GoogleMapsProvider>
  );
}
