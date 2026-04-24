import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { User, X } from 'lucide-react';
import ProviderPledgeSection from '@/components/ProviderPledgeSection';

const SUGGESTED_TAGS = [
  'Nature', 'Culture', 'Food & Cooking', 'Adventure', 'History',
  'Art & Crafts', 'Music', 'Wildlife', 'Hiking', 'Farming',
  'Fishing', 'Meditation', 'Photography', 'Language', 'Volunteering',
];

export default function Profile() {
  const { user, role, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name);
      setLastName(profile.last_name);
      setBio(profile.bio ?? '');
      setTags(profile.interest_tags ?? []);
    }
  }, [profile]);

  const toggleTag = (tag: string) => {
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const addCustomTag = () => {
    const t = customTag.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
      setCustomTag('');
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      first_name: firstName,
      last_name: lastName,
      bio: bio || null,
      interest_tags: tags,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Profile updated!' });
      refreshProfile();
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-heading font-bold">My Profile</h1>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Personal Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email ?? ''} disabled />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Input value={role === 'provider' ? 'Local Provider' : 'Traveller'} disabled className="capitalize" />
          </div>
          <div className="space-y-2">
            <Label>Bio</Label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell us about yourself…" />
          </div>
        </CardContent>
      </Card>

      {role === 'traveller' && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Interest Tags</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_TAGS.map((tag) => (
                <Badge
                  key={tag}
                  variant={tags.includes(tag) ? 'default' : 'outline'}
                  className={`cursor-pointer transition-all ${tags.includes(tag) ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'hover:bg-secondary'}`}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                  {tags.includes(tag) && <X className="h-3 w-3 ml-1" />}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                placeholder="Add custom tag…"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomTag())}
              />
              <Button variant="outline" onClick={addCustomTag}>Add</Button>
            </div>
            {tags.filter((t) => !SUGGESTED_TAGS.includes(t)).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.filter((t) => !SUGGESTED_TAGS.includes(t)).map((tag) => (
                  <Badge key={tag} className="bg-accent text-accent-foreground cursor-pointer" onClick={() => toggleTag(tag)}>
                    {tag} <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {role === 'provider' && <ProviderPledgeSection />}

      <Button onClick={handleSave} disabled={saving} className="bg-gradient-primary hover:opacity-90 text-primary-foreground">
        {saving ? 'Saving…' : 'Save Changes'}
      </Button>
    </div>
  );
}
