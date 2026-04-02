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
import { ArrowLeft, X, CalendarIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const PREDEFINED_TAGS = [
  'Culinary', 'Nature', 'Crafts', 'Heritage', 'Adventure',
  'Music', 'Wellness', 'Agriculture', 'Wildlife', 'Festivals',
];

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function NewListing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [price, setPrice] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('');
  const [startHour, setStartHour] = useState('');
  const [duration, setDuration] = useState('');
  const [recurrenceType, setRecurrenceType] = useState<'one-time' | 'recurring'>('one-time');
  const [scheduleDays, setScheduleDays] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const addCustomTag = () => {
    const trimmed = customTag.trim();
    if (trimmed && !selectedTags.includes(trimmed)) {
      setSelectedTags((prev) => [...prev, trimmed]);
      setCustomTag('');
    }
  };

  const toggleDay = (day: string) => {
    setScheduleDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('activities').insert({
      provider_id: user.id,
      title,
      description: description || null,
      location: location || null,
      price: price ? parseFloat(price) : null,
      duration_minutes: duration ? parseInt(duration) : null,
      max_participants: maxParticipants ? parseInt(maxParticipants) : null,
      start_hour: startHour || null,
      recurrence_type: recurrenceType,
      schedule_days: recurrenceType === 'recurring' ? scheduleDays : [],
      interest_tags: selectedTags,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Listing created!' });
      navigate('/dashboard');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-4 gap-2 text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to My Listings
      </Button>
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-heading">Create a New Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">Activity Title *</Label>
              <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Traditional Cooking Class" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the experience…" rows={4} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc">Location</Label>
              <Input id="loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Ubud, Bali" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-2">
                <Label htmlFor="price">Price (USD)</Label>
                <Input id="price" type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="25.00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max">Capacity</Label>
                <Input id="max" type="number" min="1" value={maxParticipants} onChange={(e) => setMaxParticipants(e.target.value)} placeholder="10" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="start">Start Hour</Label>
                <Input id="start" type="time" value={startHour} onChange={(e) => setStartHour(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dur">Duration (min)</Label>
                <Input id="dur" type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="120" />
              </div>
            </div>

            {/* Recurrence */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Label>Recurrence</Label>
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${recurrenceType === 'one-time' ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>One-time</span>
                  <Switch
                    checked={recurrenceType === 'recurring'}
                    onCheckedChange={(checked) => setRecurrenceType(checked ? 'recurring' : 'one-time')}
                  />
                  <span className={`text-sm ${recurrenceType === 'recurring' ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>Recurring</span>
                </div>
              </div>
              {recurrenceType === 'recurring' && (
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <label key={day} className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox checked={scheduleDays.includes(day)} onCheckedChange={() => toggleDay(day)} />
                      <span className="text-sm">{day}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Interest Tags */}
            <div className="space-y-3">
              <Label>Interest Tags</Label>
              <div className="flex flex-wrap gap-2">
                {PREDEFINED_TAGS.map((tag) => (
                  <Badge
                    key={tag}
                    variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add custom tag…"
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag(); } }}
                />
                <Button type="button" variant="outline" onClick={addCustomTag} size="sm">Add</Button>
              </div>
              {selectedTags.filter((t) => !PREDEFINED_TAGS.includes(t)).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedTags.filter((t) => !PREDEFINED_TAGS.includes(t)).map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => toggleTag(tag)} />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Button type="submit" className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground" disabled={saving}>
              {saving ? 'Creating…' : 'Create Listing'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
