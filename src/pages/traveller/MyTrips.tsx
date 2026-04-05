import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Calendar, Plus } from 'lucide-react';
import { format } from 'date-fns';

interface Trip {
  id: string;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  stop_count: number;
}

export default function MyTrips() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchTrips = async () => {
      const { data } = await supabase
        .from('trips')
        .select('id, title, description, start_date, end_date, status, trip_stops(id)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (data) {
        setTrips(data.map((t: any) => ({ ...t, stop_count: t.trip_stops?.length ?? 0 })));
      }
      setLoading(false);
    };
    fetchTrips();
  }, [user]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-heading font-bold">My Trips</h1>
        <Button onClick={() => navigate('/dashboard/new-trip')} className="gap-2 bg-gradient-primary hover:opacity-90 text-primary-foreground">
          <Plus className="h-4 w-4" /> New Trip
        </Button>
      </div>

      {trips.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No trips yet</h3>
            <p className="text-muted-foreground mb-4">Start planning your first community-based travel experience!</p>
            <Button onClick={() => navigate('/dashboard/new-trip')} className="gap-2 bg-gradient-primary hover:opacity-90 text-primary-foreground">
              <Plus className="h-4 w-4" /> Create Your First Trip
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <Card key={trip.id} className="shadow-card hover:shadow-card-hover transition-shadow cursor-pointer group" onClick={() => navigate(`/dashboard/trip/${trip.id}`)}>
              <CardHeader>
                <CardTitle className="text-lg group-hover:text-primary transition-colors">{trip.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {trip.start_date && trip.end_date && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{format(new Date(trip.start_date), 'MMM d')} — {format(new Date(trip.end_date), 'MMM d, yyyy')}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{trip.stop_count} {trip.stop_count === 1 ? 'stop' : 'stops'}</span>
                </div>
                <span className="inline-block text-xs font-medium px-2 py-1 rounded-full bg-secondary text-secondary-foreground capitalize">
                  {trip.status}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
