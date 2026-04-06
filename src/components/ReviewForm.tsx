import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ReviewForm({ bookingId, activityId, activityTitle, travellerId, providerId, open, onOpenChange, onReviewed }: {
  bookingId: string;
  activityId: string;
  activityTitle: string;
  travellerId: string;
  providerId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onReviewed?: () => void;
}) {
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    const { error } = await supabase.from('reviews').insert({
      booking_id: bookingId,
      activity_id: activityId,
      traveller_id: travellerId,
      provider_id: providerId,
      rating,
      comment: comment.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Review submitted!' });
    onReviewed?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Review: {activityTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="flex gap-1 justify-center">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setRating(s)}
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() => setHover(0)}
                className="p-1"
              >
                <Star className={`h-7 w-7 transition-colors ${s <= (hover || rating) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
              </button>
            ))}
          </div>
          <Textarea placeholder="Share your experience (optional)" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
          <Button className="w-full" disabled={rating === 0 || submitting} onClick={handleSubmit}>
            {submitting ? 'Submitting…' : 'Submit Review'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
