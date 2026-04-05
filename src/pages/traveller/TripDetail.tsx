import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MapPin, Calendar, DollarSign } from 'lucide-react';
import GoogleMapsProvider from '@/components/GoogleMapsProvider';
import TripMap from '@/components/TripMap';

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

function TripDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<any>(null);
  const [stops, setStops] = useState<TripStop[]>([]);
  const [recommendations, setRecommendations] = useState<Record<string, Activity[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const { data: tripData } = await supabase.from('trips').select('*').eq('id', id).eq('user_id', user.id).single();
      if (!tripData) { navigate('/dashboard'); return; }
      setTrip(tripData);

      const { data: stopsData } = await supabase.from('trip_stops').select('*').eq('trip_id', id).order('order_index');
      setStops(stopsData || []);
      setLoading(false);

      // Fetch recommendations for each stop
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
          // Fetch provider names
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
  }, [id, user]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!trip) return null;

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={() => navigate('/dashboard')} className="gap-2 text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to My Trips
      </Button>
      <h1 className="text-2xl font-heading font-bold">{trip.title}</h1>
      {trip.description && <p className="text-muted-foreground">{trip.description}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Stops + Recommendations */}
        <div className="space-y-4">
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
              <CardContent>
                {recommendations[stop.id] && recommendations[stop.id].length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Recommended Activities</p>
                    {recommendations[stop.id].map((act) => (
                      <Link key={act.id} to={`/dashboard/activity/${act.id}`} className="block">
                        <div className="border rounded-lg p-3 hover:shadow-card-hover transition-shadow cursor-pointer">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-sm">{act.title}</p>
                              <p className="text-xs text-muted-foreground">{act.provider_name}{act.community_name ? ` · ${act.community_name}` : ''}</p>
                            </div>
                            {act.price != null && (
                              <span className="text-sm font-semibold flex items-center gap-0.5">
                                <DollarSign className="h-3 w-3" />{act.price}
                              </span>
                            )}
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
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No activities found near this stop.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Right: Map */}
        <div className="sticky top-4">
          <TripMap stops={stops} className="h-[500px] w-full rounded-lg overflow-hidden shadow-card" />
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
