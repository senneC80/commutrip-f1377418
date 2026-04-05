import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, GripVertical, X } from 'lucide-react';
import PlacesAutocomplete from '@/components/PlacesAutocomplete';
import GoogleMapsProvider from '@/components/GoogleMapsProvider';

interface TripStop {
  tempId: string;
  location_name: string;
  latitude: number | null;
  longitude: number | null;
  arrival_date: string;
  departure_date: string;
}

function NewTripForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [stops, setStops] = useState<TripStop[]>([]);
  const [saving, setSaving] = useState(false);

  const addStop = () => {
    setStops((prev) => [
      ...prev,
      { tempId: crypto.randomUUID(), location_name: '', latitude: null, longitude: null, arrival_date: '', departure_date: '' },
    ]);
  };

  const updateStop = (idx: number, updates: Partial<TripStop>) => {
    setStops((prev) => prev.map((s, i) => (i === idx ? { ...s, ...updates } : s)));
  };

  const removeStop = (idx: number) => {
    setStops((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveStop = (from: number, to: number) => {
    if (to < 0 || to >= stops.length) return;
    const updated = [...stops];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    setStops(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .insert({ user_id: user.id, title, description: description || null, start_date: startDate || null, end_date: endDate || null })
      .select('id')
      .single();

    if (tripError || !trip) {
      toast({ title: 'Error', description: tripError?.message, variant: 'destructive' });
      setSaving(false);
      return;
    }

    if (stops.length > 0) {
      const stopsToInsert = stops.map((s, i) => ({
        trip_id: trip.id,
        location_name: s.location_name,
        latitude: s.latitude,
        longitude: s.longitude,
        arrival_date: s.arrival_date || null,
        departure_date: s.departure_date || null,
        order_index: i,
      }));
      const { error: stopsError } = await supabase.from('trip_stops').insert(stopsToInsert);
      if (stopsError) {
        toast({ title: 'Trip created but stops failed', description: stopsError.message, variant: 'destructive' });
      }
    }

    setSaving(false);
    toast({ title: 'Trip created!' });
    navigate('/dashboard');
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-4 gap-2 text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to My Trips
      </Button>
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-heading">Create a New Trip</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">Trip Title *</Label>
              <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Japan Spring Adventure" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's this trip about?" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="start">Start Date</Label>
                <Input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">End Date</Label>
                <Input id="end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            {/* Stops */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Trip Stops</Label>
                <Button type="button" variant="outline" size="sm" onClick={addStop} className="gap-1">
                  <Plus className="h-4 w-4" /> Add Stop
                </Button>
              </div>
              {stops.length === 0 && (
                <p className="text-sm text-muted-foreground">No stops yet. Add stops to get activity recommendations for each location.</p>
              )}
              {stops.map((stop, idx) => (
                <Card key={stop.tempId} className="p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-0.5">
                      <button type="button" onClick={() => moveStop(idx, idx - 1)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5">
                        <GripVertical className="h-3 w-3 rotate-180" />
                      </button>
                      <button type="button" onClick={() => moveStop(idx, idx + 1)} disabled={idx === stops.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5">
                        <GripVertical className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                    <div className="flex-1">
                      <PlacesAutocomplete
                        value={stop.location_name}
                        onChange={({ name, lat, lng }) => updateStop(idx, { location_name: name, latitude: lat, longitude: lng })}
                        placeholder="Search for a city or place…"
                      />
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeStop(idx)} className="text-destructive h-8 w-8">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pl-12">
                    <div className="space-y-1">
                      <Label className="text-xs">Arrival</Label>
                      <Input type="date" value={stop.arrival_date} onChange={(e) => updateStop(idx, { arrival_date: e.target.value })} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Departure</Label>
                      <Input type="date" value={stop.departure_date} onChange={(e) => updateStop(idx, { departure_date: e.target.value })} className="h-8 text-sm" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <Button type="submit" className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground" disabled={saving}>
              {saving ? 'Creating…' : 'Create Trip'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewTrip() {
  return (
    <GoogleMapsProvider>
      <NewTripForm />
    </GoogleMapsProvider>
  );
}
