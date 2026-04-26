import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet } from 'lucide-react';
import { computeBreakdown, formatMoney } from '@/lib/pricing';

export default function TripImpactSummary({ travellerId, activityIds }: { travellerId: string; activityIds: string[] }) {
  const [data, setData] = useState<{
    totalSpent: number;
    toProviders: number;
    commission: number;
    paymentFees: number;
    contributions: { communityName: string; amount: number }[];
  } | null>(null);

  useEffect(() => {
    if (activityIds.length === 0) { setData(null); return; }
    (async () => {
      const { data: bks } = await supabase
        .from('bookings')
        .select('id, total_price, commission_amount, participants, activity_id, provider_id')
        .eq('traveller_id', travellerId)
        .in('activity_id', activityIds);
      if (!bks || bks.length === 0) { setData(null); return; }

      const bookingIds = bks.map(b => b.id);

      // Fetch traveller top-ups for these bookings
      const { data: contribs } = await supabase
        .from('fund_contributions')
        .select('amount, fund_id, booking_id')
        .eq('contributor_id', travellerId)
        .eq('source_type', 'traveller_topup')
        .in('booking_id', bookingIds);

      const topUpByBooking: Record<string, number> = {};
      (contribs || []).forEach(c => {
        if (c.booking_id) topUpByBooking[c.booking_id] = (topUpByBooking[c.booking_id] || 0) + Number(c.amount);
      });

      let toProviders = 0, commission = 0, paymentFees = 0, totalSpent = 0;
      for (const b of bks) {
        const subtotal = Number(b.total_price || 0);
        const breakdown = computeBreakdown({
          pricePerPerson: subtotal / Math.max(1, b.participants || 1),
          participants: b.participants || 1,
          topUp: topUpByBooking[b.id] || 0,
        });
        toProviders += breakdown.providerNet;
        commission += breakdown.commission;
        paymentFees += breakdown.paymentFee;
        totalSpent += breakdown.total;
      }

      const byCommunity: { communityName: string; amount: number }[] = [];
      if (contribs && contribs.length > 0) {
        const fundIds = [...new Set(contribs.map(c => c.fund_id))];
        const { data: funds } = await supabase.from('community_funds').select('id, community_id').in('id', fundIds);
        const commIds = funds?.map(f => f.community_id) || [];
        const { data: comms } = await supabase.from('communities').select('id, name').in('id', commIds);
        const fundToComm: Record<string, string> = {};
        funds?.forEach(f => {
          const c = comms?.find(x => x.id === f.community_id);
          if (c) fundToComm[f.id] = c.name;
        });
        const sums: Record<string, number> = {};
        for (const c of contribs) {
          const name = fundToComm[c.fund_id] || 'Community';
          sums[name] = (sums[name] || 0) + Number(c.amount);
        }
        for (const [name, amt] of Object.entries(sums)) byCommunity.push({ communityName: name, amount: amt });
      }

      setData({ totalSpent, toProviders, commission, paymentFees, contributions: byCommunity });
    })();
  }, [travellerId, activityIds.join(',')]);

  if (!data || data.totalSpent === 0) return null;

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><Wallet className="h-5 w-5 text-primary" /> Trip Impact Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">To providers</span><span className="font-medium">{formatMoney(data.toProviders)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Platform commission</span><span>{formatMoney(data.commission)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Payment processing</span><span>{formatMoney(data.paymentFees)}</span></div>
        {data.contributions.map(c => (
          <div key={c.communityName} className="flex justify-between text-primary">
            <span>Contribution to {c.communityName} fund</span>
            <span>{formatMoney(c.amount)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t pt-2 mt-2 font-semibold">
          <span>Total spent on this trip</span>
          <span>{formatMoney(data.totalSpent)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
