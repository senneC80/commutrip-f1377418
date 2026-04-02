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
import { ArrowLeft } from 'lucide-react';

export default function NewListing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('');
  const [saving, setSaving] = useState(false);

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
    <div className="max-w-lg mx-auto">
      <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-4 gap-2 text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to My Listings
      </Button>
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-heading">Create a New Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Activity Title</Label>
              <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Traditional Cooking Class" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the experience…" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc">Location</Label>
              <Input id="loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Ubud, Bali" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="price">Price (USD)</Label>
                <Input id="price" type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="25.00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dur">Duration (min)</Label>
                <Input id="dur" type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="120" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max">Max People</Label>
                <Input id="max" type="number" min="1" value={maxParticipants} onChange={(e) => setMaxParticipants(e.target.value)} placeholder="10" />
              </div>
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
