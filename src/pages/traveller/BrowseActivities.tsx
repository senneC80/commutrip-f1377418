import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { MapPin, DollarSign, Users } from 'lucide-react';
import VerifiedBadge from '@/components/VerifiedBadge';
import { useVerifiedCommunities } from '@/hooks/useVerifiedCommunities';

const ALL_TAGS = [
  'Culinary', 'Nature', 'Crafts', 'Heritage', 'Adventure',
  'Music', 'Wellness', 'Agriculture', 'Wildlife', 'Festivals',
];

interface Activity {
  id: string;
  title: string;
  location: string | null;
  price: number | null;
  currency: string;
  interest_tags: string[] | null;
  provider_id: string;
  provider_name?: string;
  community_name?: string | null;
  community_id?: string | null;
}

interface CommunityItem {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
}

export default function Browse() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [communities, setCommunities] = useState<CommunityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationFilter, setLocationFilter] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState([0, 500]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const { verifiedIds } = useVerifiedCommunities();

  useEffect(() => {
    (async () => {
      // Fetch activities
      const { data } = await supabase.from('activities').select('id, title, location, price, currency, interest_tags, provider_id').eq('is_active', true);
      if (data) {
        const providerIds = [...new Set(data.map(a => a.provider_id))];
        const [{ data: profiles }, { data: memberships }] = await Promise.all([
          supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', providerIds),
          supabase.rpc('get_providers_accepted_communities', { _provider_ids: providerIds }),
        ]);
        const nameMap: Record<string, string> = {};
        profiles?.forEach(p => { nameMap[p.user_id] = `${p.first_name} ${p.last_name}`.trim(); });

        // Fetch community names for providers who are members
        const communityIds = [...new Set((memberships || []).map((m: any) => m.community_id))];
        let commNameMap: Record<string, { id: string; name: string }> = {};
        if (communityIds.length > 0) {
          const { data: comms } = await supabase.from('communities').select('id, name').in('id', communityIds);
          comms?.forEach(c => { commNameMap[c.id] = { id: c.id, name: c.name }; });
        }
        const providerCommMap: Record<string, { id: string; name: string }> = {};
        (memberships || []).forEach((m: any) => {
          if (commNameMap[m.community_id]) providerCommMap[m.provider_id] = commNameMap[m.community_id];
        });

        setActivities(data.map(a => ({
          ...a,
          provider_name: nameMap[a.provider_id] || 'Provider',
          community_name: providerCommMap[a.provider_id]?.name || null,
          community_id: providerCommMap[a.provider_id]?.id || null,
        })));
      }

      // Fetch communities
      const { data: allComms } = await supabase.from('communities').select('id, name, description');
      if (allComms) {
        const { data: counts } = await supabase.rpc('get_community_member_counts');
        const countMap: Record<string, number> = {};
        (counts || []).forEach((c: any) => { countMap[c.community_id] = Number(c.member_count) || 0; });
        setCommunities(allComms.map(c => ({ ...c, member_count: countMap[c.id] || 0 })));
      }

      setLoading(false);
    })();
  }, []);

  const toggleTag = (tag: string) => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  const filtered = useMemo(() => {
    return activities.filter(a => {
      if (locationFilter && !(a.location || '').toLowerCase().includes(locationFilter.toLowerCase())) return false;
      if (selectedTags.length > 0 && !selectedTags.some(t => a.interest_tags?.includes(t))) return false;
      if (a.price != null && (a.price < priceRange[0] || a.price > priceRange[1])) return false;
      if (verifiedOnly && (!a.community_id || !verifiedIds.has(a.community_id))) return false;
      return true;
    });
  }, [activities, locationFilter, selectedTags, priceRange, verifiedOnly, verifiedIds]);

  const filteredCommunities = useMemo(
    () => verifiedOnly ? communities.filter(c => verifiedIds.has(c.id)) : communities,
    [communities, verifiedOnly, verifiedIds],
  );

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-heading font-bold">Browse</h1>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={verifiedOnly} onCheckedChange={setVerifiedOnly} />
          <span className="flex items-center gap-1">Verified only <VerifiedBadge size="sm" /></span>
        </label>
      </div>

      <Tabs defaultValue="activities">
        <TabsList>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="communities">Communities</TabsTrigger>
        </TabsList>

        <TabsContent value="activities" className="space-y-5 mt-4">
          {/* Filters */}
          <Card className="shadow-card">
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Location</Label>
                  <Input placeholder="Filter by location…" value={locationFilter} onChange={e => setLocationFilter(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Price Range (0–{priceRange[1]}+ USD)</Label>
                  <Slider min={0} max={500} step={10} value={priceRange} onValueChange={setPriceRange} className="mt-2" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Interest Tags</Label>
                  <div className="flex flex-wrap gap-1">
                    {ALL_TAGS.map(tag => (
                      <Badge key={tag} variant={selectedTags.includes(tag) ? 'default' : 'outline'} className="cursor-pointer text-xs" onClick={() => toggleTag(tag)}>
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          {filtered.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">No activities match your filters.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(a => {
                const isVerified = !!(a.community_id && verifiedIds.has(a.community_id));
                return (
                <Link key={a.id} to={`/dashboard/activity/${a.id}`}>
                  <Card className="shadow-card hover:shadow-card-hover transition-shadow cursor-pointer h-full">
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-heading font-semibold">{a.title}</h3>
                        {isVerified && <VerifiedBadge size="sm" />}
                      </div>
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
                        <span className="text-xs text-muted-foreground">{a.provider_name}</span>
                      </div>
                      {a.community_name && (
                        <Link
                          to={`/dashboard/community/${a.community_id}`}
                          onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                        >
                          <Users className="h-3 w-3" /> {a.community_name}
                        </Link>
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
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="communities" className="mt-4">
          {filteredCommunities.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">No communities match your filters.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCommunities.map(c => (
                <Link key={c.id} to={`/dashboard/community/${c.id}`}>
                  <Card className="shadow-card hover:shadow-card-hover transition-shadow cursor-pointer h-full">
                    <CardContent className="pt-4 space-y-2">
                      <h3 className="font-heading font-semibold flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" /> {c.name}
                        {verifiedIds.has(c.id) && <VerifiedBadge size="sm" />}
                      </h3>
                      {c.description && <p className="text-sm text-muted-foreground line-clamp-2">{c.description}</p>}
                      <p className="text-xs text-muted-foreground">{c.member_count} member{c.member_count !== 1 ? 's' : ''}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
