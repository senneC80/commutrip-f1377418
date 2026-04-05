import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Trash2, X, CalendarIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import GoogleMapsProvider from '@/components/GoogleMapsProvider';
import PlacesAutocomplete from '@/components/PlacesAutocomplete';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const PREDEFINED_TAGS = [
  'Culinary', 'Nature', 'Crafts', 'Heritage', 'Adventure',
  'Music', 'Wellness', 'Agriculture', 'Wildlife', 'Festivals',
];
const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function EditListingForm() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [price, setPrice] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('');
  const [startHour, setStartHour] = useState('');
  const [duration, setDuration] = useState('');
  const [recurrenceType, setRecurrenceType] = useState<'one-time' | 'recurring'>('one-time');
  const [scheduleDays, setScheduleDays] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [eventDate, setEventDate] = useState<Date | undefined>();
  const [availableFrom, setAvailableFrom] = useState<Date | undefined>();
  const [availableUntil, setAvailableUntil] = useState<Date | undefined>();
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('id', id)
        .eq('provider_id', user.id)
        .single();
      if (error || !data) {
        toast({ title: 'Listing not found', variant: 'destructive' });
        navigate('/dashboard');
        return;
      }
      setTitle(data.title);
      setDescription(data.description || '');
      setLocation(data.location || '');
      setLatitude(data.latitude || null);
      setLongitude(data.longitude || null);
      setMaxParticipants(data.max_participants != null ? String(data.max_participants) : '');
      setStartHour(data.start_hour || '');
      setDuration(data.duration_minutes != null ? String(data.duration_minutes) : '');
      setRecurrenceType((data.recurrence_type as 'one-time' | 'recurring') || 'one-time');
      setScheduleDays(data.schedule_days || []);
      setSelectedTags(data.interest_tags || []);
      setEventDate(data.event_date ? parseISO(data.event_date) : undefined);
      setAvailableFrom(data.available_from ? parseISO(data.available_from) : undefined);
      setAvailableUntil(data.available_until ? parseISO(data.available_until) : undefined);
      setIsActive(data.is_active);
      setLoading(false);
    })();
  }, [id, user]);

  const toggleTag = (tag: string) => setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  const addCustomTag = () => { const t = customTag.trim(); if (t && !selectedTags.includes(t)) { setSelectedTags((p) => [...p, t]); setCustomTag(''); } };
  const toggleDay = (day: string) => setScheduleDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    if (recurrenceType === 'recurring' && !availableFrom) {
      toast({ title: 'Available From date is required for recurring activities', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('activities').update({
      title,
      description: description || null,
      location: location || null,
      latitude,
      longitude,
      price: price ? parseFloat(price) : null,
      duration_minutes: duration ? parseInt(duration) : null,
      max_participants: maxParticipants ? parseInt(maxParticipants) : null,
      start_hour: startHour || null,
      recurrence_type: recurrenceType,
      schedule_days: recurrenceType === 'recurring' ? scheduleDays : [],
      event_date: recurrenceType === 'one-time' && eventDate ? format(eventDate, 'yyyy-MM-dd') : null,
      available_from: recurrenceType === 'recurring' && availableFrom ? format(availableFrom, 'yyyy-MM-dd') : null,
      available_until: recurrenceType === 'recurring' && availableUntil ? format(availableUntil, 'yyyy-MM-dd') : null,
      interest_tags: selectedTags,
      is_active: isActive,
    }).eq('id', id);
    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Listing updated!' });
      navigate('/dashboard');
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    const { error } = await supabase.from('activities').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error deleting', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Listing deleted' });
      navigate('/dashboard');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-2xl mx-auto">
      <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-4 gap-2 text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to My Listings
      </Button>
      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading">Edit Listing</CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Active</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-1"><Trash2 className="h-4 w-4" /> Delete</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this listing?</AlertDialogTitle>
                  <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">Activity Title *</Label>
              <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <PlacesAutocomplete
                value={location}
                onChange={({ name, lat, lng }) => { setLocation(name); setLatitude(lat); setLongitude(lng); }}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-2">
                <Label htmlFor="price">Price (USD)</Label>
                <Input id="price" type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max">Capacity</Label>
                <Input id="max" type="number" min="1" value={maxParticipants} onChange={(e) => setMaxParticipants(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="start">Start Hour</Label>
                <Input id="start" type="time" value={startHour} onChange={(e) => setStartHour(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dur">Duration (min)</Label>
                <Input id="dur" type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Label>Recurrence</Label>
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${recurrenceType === 'one-time' ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>One-time</span>
                  <Switch checked={recurrenceType === 'recurring'} onCheckedChange={(c) => setRecurrenceType(c ? 'recurring' : 'one-time')} />
                  <span className={`text-sm ${recurrenceType === 'recurring' ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>Recurring</span>
                </div>
              </div>
              {recurrenceType === 'one-time' && (
                <div className="space-y-2">
                  <Label>Event Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal", !eventDate && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {eventDate ? format(eventDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={eventDate} onSelect={setEventDate} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
              {recurrenceType === 'recurring' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <label key={day} className="flex items-center gap-1.5 cursor-pointer">
                        <Checkbox checked={scheduleDays.includes(day)} onCheckedChange={() => toggleDay(day)} />
                        <span className="text-sm">{day}</span>
                      </label>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Available From *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn("w-full justify-start text-left font-normal", !availableFrom && "text-muted-foreground")}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {availableFrom ? format(availableFrom, "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={availableFrom} onSelect={setAvailableFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label>Available Until</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn("w-full justify-start text-left font-normal", !availableUntil && "text-muted-foreground")}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {availableUntil ? format(availableUntil, "PPP") : "No end date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={availableUntil} onSelect={setAvailableUntil} initialFocus className={cn("p-3 pointer-events-auto")} />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label>Interest Tags</Label>
              <div className="flex flex-wrap gap-2">
                {PREDEFINED_TAGS.map((tag) => (
                  <Badge key={tag} variant={selectedTags.includes(tag) ? 'default' : 'outline'} className="cursor-pointer hover:opacity-80 transition-opacity" onClick={() => toggleTag(tag)}>
                    {tag}
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input placeholder="Add custom tag…" value={customTag} onChange={(e) => setCustomTag(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag(); } }} />
                <Button type="button" variant="outline" onClick={addCustomTag} size="sm">Add</Button>
              </div>
              {selectedTags.filter((t) => !PREDEFINED_TAGS.includes(t)).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedTags.filter((t) => !PREDEFINED_TAGS.includes(t)).map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">{tag}<X className="h-3 w-3 cursor-pointer" onClick={() => toggleTag(tag)} /></Badge>
                  ))}
                </div>
              )}
            </div>

            <Button type="submit" className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function EditListing() {
  return (
    <GoogleMapsProvider>
      <EditListingForm />
    </GoogleMapsProvider>
  );
}
