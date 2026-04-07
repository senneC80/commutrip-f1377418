import { useState, useMemo } from 'react';
import { format, addDays, isAfter, isBefore, getDay, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Activity {
  id: string;
  title: string;
  price: number | null;
  currency: string;
  max_participants: number | null;
  recurrence_type: string | null;
  event_date: string | null;
  schedule_days: string[] | null;
  available_from: string | null;
  available_until: string | null;
  provider_id: string;
}

const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_NAMES_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const dayToIndex = (day: string): number => {
  const idx = DAY_NAMES_FULL.indexOf(day);
  if (idx >= 0) return idx;
  return DAY_NAMES_ABBR.indexOf(day);
};

export default function BookingModal({ activity, open, onOpenChange, onBooked }: {
  activity: Activity;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onBooked?: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [date, setDate] = useState<Date | undefined>(
    activity.recurrence_type === 'one-time' && activity.event_date ? parseISO(activity.event_date) : undefined
  );
  const [participants, setParticipants] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const pricePerPerson = activity.price ?? 0;
  const subtotal = pricePerPerson * participants;
  const commission = Math.round(subtotal * 0.05 * 100) / 100;
  const grandTotal = subtotal + commission;

  const isDateAllowed = useMemo(() => {
    if (activity.recurrence_type === 'one-time') {
      return (d: Date) => {
        if (!activity.event_date) return false;
        return format(d, 'yyyy-MM-dd') === activity.event_date;
      };
    }
    // recurring
    const allowedDays = (activity.schedule_days || []).map(day => DAY_NAMES.indexOf(day)).filter(i => i >= 0);
    const from = activity.available_from ? parseISO(activity.available_from) : null;
    const until = activity.available_until ? parseISO(activity.available_until) : null;
    return (d: Date) => {
      if (isBefore(d, new Date())) return false;
      if (from && isBefore(d, from)) return false;
      if (until && isAfter(d, addDays(until, 1))) return false;
      return allowedDays.includes(getDay(d));
    };
  }, [activity]);

  const handleConfirm = async () => {
    if (!user || !date) return;
    setSubmitting(true);
    const { error } = await supabase.from('bookings').insert({
      activity_id: activity.id,
      traveller_id: user.id,
      provider_id: activity.provider_id,
      booking_date: format(date, 'yyyy-MM-dd'),
      participants,
      total_price: subtotal,
      commission_amount: commission,
      status: 'pending',
    });
    setSubmitting(false);
    if (error) {
      toast({ title: 'Booking failed', description: error.message, variant: 'destructive' });
      return;
    }
    setConfirmed(true);
    onBooked?.();
  };

  if (confirmed) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center py-6 text-center gap-3">
            <div className="bg-primary/10 rounded-full p-3"><Check className="h-8 w-8 text-primary" /></div>
            <h2 className="text-xl font-heading font-bold">Booking Confirmed!</h2>
            <p className="text-muted-foreground text-sm">Your booking for <span className="font-medium text-foreground">{activity.title}</span> on {format(date!, 'PPP')} has been submitted.</p>
            <Button onClick={() => onOpenChange(false)} className="mt-2">Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Book: {activity.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Price per person</span>
            <span className="font-medium">{activity.currency} {pricePerPerson}</span>
          </div>

          {/* Date picker */}
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP') : 'Select a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(d) => !isDateAllowed(d)}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Participants */}
          <div className="space-y-1.5">
            <Label>Participants</Label>
            <Input
              type="number"
              min={1}
              max={activity.max_participants || 99}
              value={participants}
              onChange={(e) => setParticipants(Math.max(1, Math.min(activity.max_participants || 99, parseInt(e.target.value) || 1)))}
            />
            {activity.max_participants && <p className="text-xs text-muted-foreground">Max capacity: {activity.max_participants}</p>}
          </div>

          {/* Price breakdown */}
          <div className="border-t pt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{participants} × {activity.currency} {pricePerPerson}</span>
              <span>{activity.currency} {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Service fee (5%)</span>
              <span>{activity.currency} {commission.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold border-t pt-2">
              <span>Total</span>
              <span>{activity.currency} {grandTotal.toFixed(2)}</span>
            </div>
          </div>

          <Button className="w-full" disabled={!date || submitting} onClick={handleConfirm}>
            {submitting ? 'Confirming…' : 'Confirm Booking'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
