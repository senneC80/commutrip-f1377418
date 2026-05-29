import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet } from 'lucide-react';
import { computeBreakdown, formatMoney } from '@/lib/pricing';

interface CommunitySplit {
  communityName: string;
  travellerTopUp: number;
  providerPledge: number;
}

export default function TripImpactSummary({ travellerId, activityIds }: { travellerId: string; activityIds: string[] }) {
  const [data, setData] = useState<{
    totalSpent: number;
    toProviders: number;
    commission: number;
    paymentFees: number;
    totalToCommunities: number;
    contributions: CommunitySplit[];
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

      // All fund contributions tied to these bookings:
      // - traveller_topup (contributor = traveller)
      // - provider_pledge (contributor = provider, recorded on completion)
      const { data: allContribs } = await supabase
        .from('fund_contributions')
        .select('amount, fund_id, booking_id, source_type, contributor_id')
        .in('booking_id', bookingIds);

      const topUpByBooking: Record<string, number> = {};
      const pledgeByBooking: Record<string, number> = {};
      (allContribs || []).forEach(c => {
        if (!c.booking_id) return;
        if (c.source_type === 'traveller_topup' && c.contributor_id === travellerId) {
          topUpByBooking[c.booking_id] = (topUpByBooking[c.booking_id] || 0) + Number(c.amount);
        } else if (c.source_type === 'provider_pledge') {
          pledgeByBooking[c.booking_id] = (pledgeByBooking[c.booking_id] || 0) + Number(c.amount);
        }
      });

      let toProviders = 0, commission = 0, paymentFees = 0, totalSpent = 0;
      for (const b of bks) {
        const subtotal = Number(b.total_price || 0);
        const pledgeAmt = pledgeByBooking[b.id] || 0;
        const breakdown = computeBreakdown({
          pricePerPerson: subtotal / Math.max(1, b.participants || 1),
          participants: b.participants || 1,
          topUp: topUpByBooking[b.id] || 0,
        });
        toProviders += Math.max(0, breakdown.providerNet - pledgeAmt);
        commission += breakdown.commission;
        paymentFees += breakdown.paymentFee;
        totalSpent += breakdown.total;
      }

      // Group all fund contributions by community
      const contributions: CommunitySplit[] = [];
      let totalToCommunities = 0;
      const relevantContribs = (allContribs || []).filter(c =>
        (c.source_type === 'traveller_topup' && c.contributor_id === travellerId) ||
        c.source_type === 'provider_pledge'
      );
      if (relevantContribs.length > 0) {
        const fundIds = [...new Set(relevantContribs.map(c => c.fund_id))];
        const { data: funds } = await supabase.from('community_funds').select('id, community_id').in('id', fundIds);
        const commIds = funds?.map(f => f.community_id) || [];
        const { data: comms } = await supabase.from('communities').select('id, name').in('id', commIds);
        const fundToComm: Record<string, string> = {};
        funds?.forEach(f => {
          const c = comms?.find(x => x.id === f.community_id);
          if (c) fundToComm[f.id] = c.name;
        });
        const sums: Record<string, CommunitySplit> = {};
        for (const c of relevantContribs) {
          const name = fundToComm[c.fund_id] || 'Community';
          if (!sums[name]) sums[name] = { communityName: name, travellerTopUp: 0, providerPledge: 0 };
          if (c.source_type === 'traveller_topup') sums[name].travellerTopUp += Number(c.amount);
          else if (c.source_type === 'provider_pledge') sums[name].providerPledge += Number(c.amount);
          totalToCommunities += Number(c.amount);
        }
        contributions.push(...Object.values(sums));
      }

      setData({ totalSpent, toProviders, commission, paymentFees, totalToCommunities, contributions });
    })();
  }, [travellerId, activityIds.join(',')]);

  if (!data || data.totalSpent === 0) return null;

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><Wallet className="h-5 w-5 text-primary" /> Trip Impact Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">To providers (after pledges)</span><span className="font-medium">{formatMoney(data.toProviders)}</span></div>
        {data.totalToCommunities > 0 && (
          <div className="flex justify-between text-primary">
            <span>To communities</span>
            <span className="font-medium">{formatMoney(data.totalToCommunities)}</span>
          </div>
        )}
        {data.contributions.map(c => (
          <div key={c.communityName} className="pl-3 border-l-2 border-primary/30 space-y-1">
            <p className="text-xs text-muted-foreground">{c.communityName} fund</p>
            {c.providerPledge > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">· Provider pledge</span>
                <span>{formatMoney(c.providerPledge)}</span>
              </div>
            )}
            {c.travellerTopUp > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">· Your top-up</span>
                <span>{formatMoney(c.travellerTopUp)}</span>
              </div>
            )}
          </div>
        ))}
        <div className="flex justify-between"><span className="text-muted-foreground">Platform commission</span><span>{formatMoney(data.commission)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Payment processing</span><span>{formatMoney(data.paymentFees)}</span></div>
        <div className="flex justify-between border-t pt-2 mt-2 font-semibold">
          <span>Total spent on this trip</span>
          <span>{formatMoney(data.totalSpent)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
