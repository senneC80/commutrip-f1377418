import { useEffect, useMemo, useState } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Check, Heart, Info, MapPin } from 'lucide-react';
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

interface TripStopOption {
  id: string;
  location_name: string;
  arrival_date: string;
  departure_date: string;
  trip_title: string;
}

const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_NAMES_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const dayToIndex = (day: string): number => {
  const idx = DAY_NAMES_FULL.indexOf(day);
  if (idx >= 0) return idx;
  return DAY_NAMES_ABBR.indexOf(day);
};

const TOPUP_PRESETS = [2, 5, 10];

export default function BookingModal({ activity, open, onOpenChange, onBooked, tripStopId }: {
  activity: Activity;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onBooked?: () => void;
  /** Optional. If set, the booking is anchored at this stop and the picker is hidden. */
  tripStopId?: string;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { fund, communityName, pledge } = useProviderCommunityFund(activity.provider_id);

  // Stop selection (skipped if tripStopId was passed in)
  const [stopOptions, setStopOptions] = useState<TripStopOption[]>([]);
  const [selectedStopId, setSelectedStopId] = useState<string | undefined>(tripStopId);
  const [stopsLoading, setStopsLoading] = useState(false);

  const [date, setDate] = useState<Date | undefined>(
    activity.recurrence_type === 'one-time' && activity.event_date ? parseISO(activity.event_date) : undefined
  );
  const [participants, setParticipants] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [topUpPreset, setTopUpPreset] = useState<number | 'custom' | null>(null);
  const [topUpCustom, setTopUpCustom] = useState('');

  // Keep selectedStopId in sync if the caller-supplied prop changes
  useEffect(() => {
    if (tripStopId) setSelectedStopId(tripStopId);
  }, [tripStopId]);

  // Fetch eligible stops when the modal opens without a pre-chosen stop
  useEffect(() => {
    if (!open || tripStopId || !user) return;
    let cancelled = false;
    (async () => {
      setStopsLoading(true);
      // Pull all stops owned by this traveller; filter by date overlap client-side
      // so we don't have to encode the activity's window into SQL.
      const { data, error } = await supabase
        .from('trip_stops')
        .select('id, location_name, arrival_date, departure_date, trip:trips!inner(title, user_id)')
        .eq('trip.user_id', user.id)
        .not('arrival_date', 'is', null)
        .not('departure_date', 'is', null)
        .order('arrival_date', { ascending: true });
      if (cancelled) return;
      if (error) {
        toast({ title: 'Could not load your trip stops', description: error.message, variant: 'destructive' });
        setStopsLoading(false);
        return;
      }
      const fromBound = activity.available_from ? parseISO(activity.available_from) : null;
      const untilBound = activity.available_until ? parseISO(activity.available_until) : null;
      const eventDate = activity.event_date ? parseISO(activity.event_date) : null;

      const eligible: TripStopOption[] = (data || [])
        .map((row: any) => ({
          id: row.id,
          location_name: row.location_name,
          arrival_date: row.arrival_date,
          departure_date: row.departure_date,
          trip_title: row.trip?.title ?? '',
        }))
        .filter((s) => {
          const sArr = parseISO(s.arrival_date);
          const sDep = parseISO(s.departure_date);
          if (activity.recurrence_type === 'one-time') {
            if (!eventDate) return false;
            return !isBefore(eventDate, sArr) && !isAfter(eventDate, sDep);
          }
          // Recurring: stop window must overlap the activity's availability window
          if (fromBound && isBefore(sDep, fromBound)) return false;
          if (untilBound && isAfter(sArr, untilBound)) return false;
          return true;
        });
      setStopOptions(eligible);
      setStopsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, tripStopId, user, activity, toast]);

  const selectedStop = useMemo(
    () => stopOptions.find((s) => s.id === selectedStopId),
    [stopOptions, selectedStopId]
  );

  const pricePerPerson = activity.price ?? 0;
  const topUpAmount = topUpPreset === 'custom'
    ? Math.max(0, parseFloat(topUpCustom) || 0)
    : (typeof topUpPreset === 'number' ? topUpPreset : 0);
  const pledgeRate = pledge ? Number(pledge.pledge_percentage) / 100 : 0;

  const breakdown = useMemo(
    () => computeBreakdown({ pricePerPerson, participants, topUp: topUpAmount, providerPledgeRate: pledgeRate }),
    [pricePerPerson, participants, topUpAmount, pledgeRate]
  );

  // Date eligibility: combines the activity's own schedule with the selected
  // stop's [arrival, departure] window (if known).
  const isDateAllowed = useMemo(() => {
    const stopArr = selectedStop ? parseISO(selectedStop.arrival_date) : null;
    const stopDep = selectedStop ? parseISO(selectedStop.departure_date) : null;
    if (activity.recurrence_type === 'one-time') {
      return (d: Date) => {
        if (!activity.event_date) return false;
        if (format(d, 'yyyy-MM-dd') !== activity.event_date) return false;
        if (stopArr && isBefore(d, stopArr)) return false;
        if (stopDep && isAfter(d, stopDep)) return false;
        return true;
      };
    }
    const allowedDays = (activity.schedule_days || []).map((day) => dayToIndex(day)).filter((i) => i >= 0);
    const from = activity.available_from ? parseISO(activity.available_from) : null;
    const until = activity.available_until ? parseISO(activity.available_until) : null;
    return (d: Date) => {
      if (isBefore(d, new Date())) return false;
      if (from && isBefore(d, from)) return false;
      if (until && isAfter(d, addDays(until, 1))) return false;
      if (stopArr && isBefore(d, stopArr)) return false;
      if (stopDep && isAfter(d, stopDep)) return false;
      return allowedDays.includes(getDay(d));
    };
  }, [activity, selectedStop]);

  // Reset the picked date if it stops being eligible after the user changes stop.
  useEffect(() => {
    if (date && !isDateAllowed(date)) setDate(undefined);
  }, [isDateAllowed, date]);

  const handleConfirm = async () => {
    if (!user || !date || !selectedStopId) return;
    setSubmitting(true);
    const { error } = await supabase.rpc('create_booking_with_topup', {
      _activity_id: activity.id,
      _provider_id: activity.provider_id,
      _trip_stop_id: selectedStopId,
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

  // Empty state: no eligible stops to anchor this booking to.
  const showStopPicker = !tripStopId;
  const noEligibleStops = showStopPicker && !stopsLoading && stopOptions.length === 0;
  if (noEligibleStops) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Book: {activity.title}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-6 text-center gap-3">
            <div className="bg-muted rounded-full p-3"><MapPin className="h-7 w-7 text-muted-foreground" /></div>
            <p className="text-sm">You'll need a trip stop covering these dates to book this activity.</p>
            <p className="text-xs text-muted-foreground">Create one from the Trips page.</p>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="mt-2">Close</Button>
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
          {/* Stop picker (only when caller didn't pre-supply a stop) */}
          {showStopPicker && (
            <div className="space-y-1.5">
              <Label>Trip stop</Label>
              <Select value={selectedStopId} onValueChange={setSelectedStopId} disabled={stopsLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={stopsLoading ? 'Loading…' : 'Choose a stop'} />
                </SelectTrigger>
                <SelectContent>
                  {stopOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.trip_title} — {s.location_name} ({format(parseISO(s.arrival_date), 'MMM d')} → {format(parseISO(s.departure_date), 'MMM d')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Bookings are anchored at a stop in one of your trips.</p>
            </div>
          )}

          {/* Date picker */}
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" disabled={!selectedStopId} className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP') : selectedStopId ? 'Select a date' : 'Pick a stop first'}
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
              <span className="text-muted-foreground">To provider ({participants} × {formatMoney(pricePerPerson, currency)}{pledge ? ', after pledge' : ''})</span>
              <span>{formatMoney(breakdown.providerNet, currency)}</span>
            </div>
            {breakdown.providerPledge > 0 && (
              <div className="flex justify-between text-primary">
                <span>Community fund contribution ({Number(pledge!.pledge_percentage)}% from provider)</span>
                <span>{formatMoney(breakdown.providerPledge, currency)}</span>
              </div>
            )}
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
                <span>Your top-up to {communityName} fund</span>
                <span>{formatMoney(breakdown.topUp, currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold border-t pt-2 mt-1">
              <span>Total</span>
              <span>{formatMoney(breakdown.total, currency)}</span>
            </div>
          </div>

          <Button className="w-full" disabled={!date || !selectedStopId || submitting} onClick={handleConfirm}>
            {submitting ? 'Confirming…' : 'Confirm Booking'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
