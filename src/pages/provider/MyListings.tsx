import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Package, Clock, DollarSign, MapPin, CalendarDays, Users } from 'lucide-react';

interface Activity {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  price: number | null;
  currency: string;
  duration_minutes: number | null;
  is_active: boolean;
  interest_tags: string[] | null;
}

interface Booking {
  id: string;
  activity_id: string;
  activity_title: string;
  traveller_name: string;
  booking_date: string;
  participants: number;
  total_price: number | null;
  status: string;
}

export default function MyListings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: acts } = await supabase
        .from('activities')
        .select('id, title, description, location, price, currency, duration_minutes, is_active, interest_tags')
        .eq('provider_id', user.id)
        .order('created_at', { ascending: false });
      if (acts) setActivities(acts);

      // Fetch bookings for my activities
      const today = new Date().toISOString().split('T')[0];
      const { data: bks } = await supabase
        .from('bookings')
        .select('id, activity_id, booking_date, participants, total_price, status, traveller_id')
        .eq('provider_id', user.id)
        .gte('booking_date', today)
        .order('booking_date', { ascending: true });

      if (bks && bks.length > 0) {
        const travIds = [...new Set(bks.map(b => b.traveller_id))];
        const actIds = [...new Set(bks.map(b => b.activity_id))];
        const [{ data: profiles }, { data: actData }] = await Promise.all([
          supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', travIds),
          supabase.from('activities').select('id, title').in('id', actIds),
        ]);
        const nameMap: Record<string, string> = {};
        profiles?.forEach(p => { nameMap[p.user_id] = `${p.first_name} ${p.last_name}`.trim(); });
        const titleMap: Record<string, string> = {};
        actData?.forEach(a => { titleMap[a.id] = a.title; });

        setBookings(bks.map(b => ({
          id: b.id,
          activity_id: b.activity_id,
          activity_title: titleMap[b.activity_id] || 'Activity',
          traveller_name: nameMap[b.traveller_id] || 'Traveller',
          booking_date: b.booking_date,
          participants: b.participants,
          total_price: b.total_price,
          status: b.status,
        })));
      }
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-heading font-bold">My Listings</h1>
        <Button onClick={() => navigate('/dashboard/new-listing')} className="gap-2 bg-gradient-primary hover:opacity-90 text-primary-foreground">
          <Plus className="h-4 w-4" /> New Listing
        </Button>
      </div>

      {activities.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No listings yet</h3>
            <p className="text-muted-foreground mb-4">Create your first activity listing to start hosting travellers!</p>
            <Button onClick={() => navigate('/dashboard/new-listing')} className="gap-2 bg-gradient-primary hover:opacity-90 text-primary-foreground">
              <Plus className="h-4 w-4" /> Create Your First Listing
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activities.map((a) => (
            <Card key={a.id} className="shadow-card hover:shadow-card-hover transition-shadow cursor-pointer group" onClick={() => navigate(`/dashboard/edit-listing/${a.id}`)}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg group-hover:text-primary transition-colors">{a.title}</CardTitle>
                  <span className={`inline-block text-xs font-medium px-2 py-1 rounded-full ${a.is_active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {a.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {a.location && <div className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4" /> {a.location}</div>}
                {a.price != null && <div className="flex items-center gap-2 text-sm text-muted-foreground"><DollarSign className="h-4 w-4" /> {a.currency} {a.price}</div>}
                {a.duration_minutes && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="h-4 w-4" /> {a.duration_minutes} min</div>}
                {a.interest_tags && a.interest_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {a.interest_tags.slice(0, 3).map((tag) => (<Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>))}
                    {a.interest_tags.length > 3 && <Badge variant="outline" className="text-xs">+{a.interest_tags.length - 3}</Badge>}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Incoming Bookings */}
      <div className="mt-10">
        <h2 className="text-xl font-heading font-semibold mb-4">Incoming Bookings</h2>
        {bookings.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <CalendarDays className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No bookings yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {bookings.map((b) => (
              <Card key={b.id} className="shadow-card">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{b.activity_title}</p>
                      <p className="text-sm text-muted-foreground">by {b.traveller_name}</p>
                    </div>
                    <Badge variant={b.status === 'pending' ? 'secondary' : 'default'}>{b.status}</Badge>
                  </div>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {b.booking_date}</span>
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {b.participants}</span>
                    {b.total_price != null && <span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" /> {b.total_price}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
