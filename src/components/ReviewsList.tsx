import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Star } from 'lucide-react';

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  traveller_name: string;
}

export default function ReviewsList({ activityId }: { activityId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avg, setAvg] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('reviews')
        .select('id, rating, comment, created_at, traveller_id')
        .eq('activity_id', activityId)
        .order('created_at', { ascending: false });

      if (!data || data.length === 0) { setLoading(false); return; }

      const travIds = [...new Set(data.map(r => r.traveller_id))];
      const { data: profiles } = await supabase.from('profiles').select('user_id, first_name').in('user_id', travIds);
      const nameMap: Record<string, string> = {};
      profiles?.forEach(p => { nameMap[p.user_id] = p.first_name || 'Traveller'; });

      const enriched = data.map(r => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        created_at: r.created_at,
        traveller_name: nameMap[r.traveller_id] || 'Traveller',
      }));
      setReviews(enriched);
      setAvg(data.reduce((sum, r) => sum + r.rating, 0) / data.length);
      setLoading(false);
    })();
  }, [activityId]);

  if (loading) return null;

  const Stars = ({ count }: { count: number }) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} className={`h-4 w-4 ${s <= count ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
      ))}
    </div>
  );

  return (
    <div className="border-t pt-4">
      <div className="flex items-center gap-3 mb-3">
        <h3 className="font-heading font-semibold">Reviews</h3>
        {reviews.length > 0 && (
          <div className="flex items-center gap-1.5 text-sm">
            <Stars count={Math.round(avg)} />
            <span className="font-medium">{avg.toFixed(1)}</span>
            <span className="text-muted-foreground">({reviews.length})</span>
          </div>
        )}
      </div>
      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reviews yet.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map(r => (
            <div key={r.id} className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{r.traveller_name}</span>
                  <Stars count={r.rating} />
                </div>
                <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
              {r.comment && <p className="text-sm text-foreground">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
