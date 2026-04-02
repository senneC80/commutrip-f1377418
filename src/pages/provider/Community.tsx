import { Card, CardContent } from '@/components/ui/card';
import { Users } from 'lucide-react';

export default function Community() {
  return (
    <div>
      <h1 className="text-2xl font-heading font-bold mb-6">Community</h1>
      <Card className="shadow-card">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No community yet</h3>
          <p className="text-muted-foreground">Create a community to connect with other local providers, or join an existing one.</p>
        </CardContent>
      </Card>
    </div>
  );
}
