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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CalendarIcon, Check, Heart, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { computeBreakdown, formatMoney } from '@/lib/pricing';
import { useProviderCommunityFund } from '@/hooks/useCommunityFund';

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

const TOPUP_PRESETS = [2, 5, 10];

export default function BookingModal({ activity, open, onOpenChange, onBooked }: {
  activity: Activity;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onBooked?: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { fund, communityName } = useProviderCommunityFund(activity.provider_id);
  const [date, setDate] = useState<Date | undefined>(
    activity.recurrence_type === 'one-time' && activity.event_date ? parseISO(activity.event_date) : undefined
  );
  const [participants, setParticipants] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [topUpPreset, setTopUpPreset] = useState<number | 'custom' | null>(null);
  const [topUpCustom, setTopUpCustom] = useState('');

  const pricePerPerson = activity.price ?? 0;
  const topUpAmount = topUpPreset === 'custom'
    ? Math.max(0, parseFloat(topUpCustom) || 0)
    : (typeof topUpPreset === 'number' ? topUpPreset : 0);

  const breakdown = useMemo(
    () => computeBreakdown({ pricePerPerson, participants, topUp: topUpAmount }),
    [pricePerPerson, participants, topUpAmount]
  );

  const isDateAllowed = useMemo(() => {
    if (activity.recurrence_type === 'one-time') {
      return (d: Date) => {
        if (!activity.event_date) return false;
        return format(d, 'yyyy-MM-dd') === activity.event_date;
      };
    }
    const allowedDays = (activity.schedule_days || []).map(day => dayToIndex(day)).filter(i => i >= 0);
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
    const { error } = await supabase.rpc('create_booking_with_topup', {
      _activity_id: activity.id,
      _provider_id: activity.provider_id,
      _booking_date: format(date, 'yyyy-MM-dd'),
      _participants: participants,
      _total_price: breakdown.subtotal,
      _commission_amount: breakdown.commission,
      _topup_amount: breakdown.topUp,
      _fund_id: breakdown.topUp > 0 && fund ? fund.id : null,
      _topup_currency: fund?.currency || 'EUR',
    });
    if (error) {
      setSubmitting(false);
      toast({ title: 'Booking failed', description: error.message, variant: 'destructive' });
      return;
    }
    setSubmitting(false);
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
            {breakdown.topUp > 0 && fund && (
              <p className="text-sm text-primary">Thank you for your {formatMoney(breakdown.topUp, fund.currency)} contribution to {communityName}'s fund. ❤️</p>
            )}
            <Button onClick={() => onOpenChange(false)} className="mt-2">Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const currency = activity.currency;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Book: {activity.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
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

          {/* Optional community fund top-up */}
          {fund && (
            <div className="border border-primary/30 bg-primary/5 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Heart className="h-4 w-4 text-primary" />
                Support {communityName}'s fund
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">{fund.purpose}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs text-muted-foreground">{fund.description}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {TOPUP_PRESETS.map(amt => (
                  <Button
                    key={amt}
                    type="button"
                    size="sm"
                    variant={topUpPreset === amt ? 'default' : 'outline'}
                    onClick={() => setTopUpPreset(topUpPreset === amt ? null : amt)}
                  >
                    {formatMoney(amt, fund.currency)}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant={topUpPreset === 'custom' ? 'default' : 'outline'}
                  onClick={() => setTopUpPreset(topUpPreset === 'custom' ? null : 'custom')}
                >
                  Custom
                </Button>
              </div>
              {topUpPreset === 'custom' && (
                <Input
                  type="number"
                  min={0}
                  step="0.5"
                  placeholder="Amount"
                  value={topUpCustom}
                  onChange={(e) => setTopUpCustom(e.target.value)}
                />
              )}
            </div>
          )}

          {/* Price breakdown */}
          <div className="border-t pt-3 space-y-1.5 text-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-1">Where your money goes</p>
            <div className="flex justify-between">
              <span className="text-muted-foreground">To provider ({participants} × {formatMoney(pricePerPerson, currency)})</span>
              <span>{formatMoney(breakdown.providerNet, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Platform commission (5%)</span>
              <span>{formatMoney(breakdown.commission, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment processing (~2.9% + €0.30)</span>
              <span>{formatMoney(breakdown.paymentFee, currency)}</span>
            </div>
            {breakdown.topUp > 0 && (
              <div className="flex justify-between text-primary">
                <span>Contribution to {communityName} fund</span>
                <span>{formatMoney(breakdown.topUp, currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold border-t pt-2 mt-1">
              <span>Total</span>
              <span>{formatMoney(breakdown.total, currency)}</span>
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
