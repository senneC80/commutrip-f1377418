import { BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function AdminStats() {
  return (
    <div className="max-w-4xl space-y-5">
      <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
        <BarChart3 className="h-6 w-6 text-primary" /> Stats
      </h1>
      <Card className="shadow-card">
        <CardContent className="py-12 text-center text-muted-foreground">
          Platform statistics coming soon.
        </CardContent>
      </Card>
    </div>
  );
}
