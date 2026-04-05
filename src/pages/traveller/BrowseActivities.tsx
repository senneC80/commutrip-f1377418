import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { MapPin, DollarSign } from 'lucide-react';

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
}

export default function BrowseActivities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationFilter, setLocationFilter] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState([0, 500]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('activities').select('id, title, location, price, currency, interest_tags, provider_id').eq('is_active', true);
      if (!data) { setLoading(false); return; }
      // Fetch provider names
      const providerIds = [...new Set(data.map((a) => a.provider_id))];
      const { data: profiles } = await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', providerIds);
      const nameMap: Record<string, string> = {};
      profiles?.forEach((p) => { nameMap[p.user_id] = `${p.first_name} ${p.last_name}`.trim(); });
      setActivities(data.map((a) => ({ ...a, provider_name: nameMap[a.provider_id] || 'Provider' })));
      setLoading(false);
    })();
  }, []);

  const toggleTag = (tag: string) => setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);

  const filtered = useMemo(() => {
    return activities.filter((a) => {
      if (locationFilter && !(a.location || '').toLowerCase().includes(locationFilter.toLowerCase())) return false;
      if (selectedTags.length > 0 && !selectedTags.some((t) => a.interest_tags?.includes(t))) return false;
      if (a.price != null && (a.price < priceRange[0] || a.price > priceRange[1])) return false;
      return true;
    });
  }, [activities, locationFilter, selectedTags, priceRange]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-heading font-bold">Browse Activities</h1>

      {/* Filters */}
      <Card className="shadow-card">
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Location</Label>
              <Input placeholder="Filter by location…" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Price Range (0–{priceRange[1]}+ USD)</Label>
              <Slider min={0} max={500} step={10} value={priceRange} onValueChange={setPriceRange} className="mt-2" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Interest Tags</Label>
              <div className="flex flex-wrap gap-1">
                {ALL_TAGS.map((tag) => (
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
          {filtered.map((a) => (
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
                    <span className="text-xs text-muted-foreground">{a.provider_name}</span>
                  </div>
                  {a.interest_tags && a.interest_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {a.interest_tags.slice(0, 4).map((tag) => (
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
  );
}
