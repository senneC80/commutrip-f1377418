import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Star, MapPin, DollarSign, Package, BookOpen } from 'lucide-react';
import VerifiedBadge from '@/components/VerifiedBadge';

interface CommunityData {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  manager_id: string;
}

interface MemberProfile {
  user_id: string;
  first_name: string;
  last_name: string;
  bio: string | null;
}

interface PopularActivity {
  id: string;
  title: string;
  location: string | null;
  price: number | null;
  currency: string;
  interest_tags: string[] | null;
  avg_rating: number;
  review_count: number;
}

export default function PublicCommunity() {
  const { id } = useParams<{ id: string }>();
  const [community, setCommunity] = useState<CommunityData | null>(null);
  const [managerName, setManagerName] = useState('');
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [activities, setActivities] = useState<PopularActivity[]>([]);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [metrics, setMetrics] = useState({ totalMembers: 0, totalListings: 0, avgRating: 0, totalBookings: 0 });
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      // Fetch community
      const { data: comm } = await supabase.from('communities').select('*').eq('id', id).single();
      if (!comm) { setLoading(false); return; }
      setCommunity(comm);

      // Verification status
      const { data: ver } = await supabase.from('community_verifications').select('id').eq('community_id', id).eq('status', 'approved').maybeSingle();
      setVerified(!!ver);

      // Fetch manager name
      const { data: mgrProf } = await supabase.from('profiles').select('first_name, last_name').eq('user_id', comm.manager_id).single();
      if (mgrProf) setManagerName(`${mgrProf.first_name} ${mgrProf.last_name}`.trim());

      // Fetch accepted members
      const { data: mems } = await supabase.from('community_members').select('provider_id').eq('community_id', id).eq('status', 'accepted');
      const providerIds = mems?.map(m => m.provider_id) || [];

      if (providerIds.length > 0) {
        // Fetch member profiles
        const { data: profiles } = await supabase.from('profiles').select('user_id, first_name, last_name, bio').in('user_id', providerIds);
        if (profiles) setMembers(profiles);

        // Fetch all active activities by these providers
        const { data: acts } = await supabase.from('activities').select('id, title, location, price, currency, interest_tags').eq('is_active', true).in('provider_id', providerIds);
        const actIds = acts?.map(a => a.id) || [];

        // Fetch reviews for these activities
        let reviewMap: Record<string, { sum: number; count: number }> = {};
        if (actIds.length > 0) {
          const { data: reviews } = await supabase.from('reviews').select('activity_id, rating').in('activity_id', actIds);
          reviews?.forEach(r => {
            if (!reviewMap[r.activity_id]) reviewMap[r.activity_id] = { sum: 0, count: 0 };
            reviewMap[r.activity_id].sum += r.rating;
            reviewMap[r.activity_id].count++;
          });
        }

        // Compute popular activities sorted by avg rating
        const enriched: PopularActivity[] = (acts || []).map(a => ({
          ...a,
          avg_rating: reviewMap[a.id] ? reviewMap[a.id].sum / reviewMap[a.id].count : 0,
          review_count: reviewMap[a.id]?.count || 0,
        })).sort((a, b) => b.avg_rating - a.avg_rating || b.review_count - a.review_count);
        setActivities(enriched);

        // Metrics
        const { count: bookingsCount } = await supabase.from('bookings').select('id', { count: 'exact', head: true }).in('activity_id', actIds);
        const allRatings = Object.values(reviewMap);
        const totalReviews = allRatings.reduce((s, r) => s + r.count, 0);
        const avgR = totalReviews > 0 ? allRatings.reduce((s, r) => s + r.sum, 0) / totalReviews : 0;

        setMetrics({
          totalMembers: providerIds.length,
          totalListings: acts?.length || 0,
          avgRating: avgR,
          totalBookings: bookingsCount || 0,
        });
      }

      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!community) return <p className="text-center text-muted-foreground py-12">Community not found.</p>;

  const visibleActivities = showAllActivities ? activities : activities.slice(0, 5);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <Card className="shadow-card">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            {community.image_url ? (
              <img src={community.image_url} alt={community.name} className="h-20 w-20 rounded-lg object-cover" />
            ) : (
              <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-heading font-bold">{community.name}</h1>
                {verified && <VerifiedBadge size="md" showLabel />}
              </div>
              {community.description && <p className="text-muted-foreground mt-1">{community.description}</p>}
              <p className="text-sm text-muted-foreground mt-2">Managed by <span className="text-foreground font-medium">{managerName}</span></p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Members', value: metrics.totalMembers, icon: Users },
          { label: 'Active Listings', value: metrics.totalListings, icon: Package },
          { label: 'Avg Rating', value: metrics.avgRating > 0 ? metrics.avgRating.toFixed(1) : '—', icon: Star },
          { label: 'Total Bookings', value: metrics.totalBookings, icon: BookOpen },
        ].map(m => (
          <Card key={m.label} className="shadow-card">
            <CardContent className="py-4 text-center">
              <m.icon className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-2xl font-bold">{m.value}</p>
              <p className="text-xs text-muted-foreground">{m.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Members */}
      <div>
        <h2 className="text-lg font-heading font-semibold mb-3">Members</h2>
        {members.length === 0 ? (
          <p className="text-muted-foreground text-sm">No members yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map(m => (
              <Link key={m.user_id} to={`/dashboard/provider-profile/${m.user_id}`}>
                <Card className="shadow-card hover:shadow-card-hover transition-shadow cursor-pointer h-full">
                  <CardContent className="pt-4 space-y-1">
                    <h3 className="font-heading font-semibold">{m.first_name} {m.last_name}</h3>
                    {m.bio && <p className="text-xs text-muted-foreground line-clamp-2">{m.bio}</p>}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Popular Activities */}
      <div>
        <h2 className="text-lg font-heading font-semibold mb-3">Popular Activities</h2>
        {activities.length === 0 ? (
          <p className="text-muted-foreground text-sm">No activities yet.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleActivities.map(a => (
                <Link key={a.id} to={`/dashboard/activity/${a.id}`}>
                  <Card className="shadow-card hover:shadow-card-hover transition-shadow cursor-pointer h-full">
                    <CardContent className="pt-4 space-y-2">
                      <h3 className="font-heading font-semibold">{a.title}</h3>
                      {a.location && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {a.location}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        {a.price != null && (
                          <span className="text-sm font-medium flex items-center gap-0.5">
                            <DollarSign className="h-3 w-3" /> {a.price} {a.currency}
                          </span>
                        )}
                        {a.review_count > 0 && (
                          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" /> {a.avg_rating.toFixed(1)} ({a.review_count})
                          </span>
                        )}
                      </div>
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
            {activities.length > 5 && !showAllActivities && (
              <Button variant="outline" className="mt-4 w-full" onClick={() => setShowAllActivities(true)}>
                Show More ({activities.length - 5} more)
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
