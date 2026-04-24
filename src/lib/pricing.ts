// Centralised price-breakdown helpers. No real payment processor is wired up;
// fees are a realistic Stripe-style simulation so travellers see a transparent breakdown.

export const PLATFORM_COMMISSION_RATE = 0.05; // 5% platform commission
export const PAYMENT_PROCESSING_RATE = 0.029; // 2.9%
export const PAYMENT_PROCESSING_FIXED = 0.30; // €0.30 per transaction

export interface PriceBreakdown {
  subtotal: number;        // price * participants — provider's headline take
  commission: number;      // platform commission
  paymentFee: number;      // simulated payment processing
  topUp: number;           // optional voluntary contribution
  total: number;           // what the traveller pays
  providerNet: number;     // what reaches the provider (= subtotal in our model)
}

export function computeBreakdown(opts: {
  pricePerPerson: number;
  participants: number;
  topUp?: number;
}): PriceBreakdown {
  const subtotal = round2(opts.pricePerPerson * opts.participants);
  const commission = round2(subtotal * PLATFORM_COMMISSION_RATE);
  const baseTotalPrePayment = subtotal + commission + (opts.topUp || 0);
  const paymentFee = round2(baseTotalPrePayment * PAYMENT_PROCESSING_RATE + PAYMENT_PROCESSING_FIXED);
  const total = round2(baseTotalPrePayment + paymentFee);
  return {
    subtotal,
    commission,
    paymentFee,
    topUp: round2(opts.topUp || 0),
    total,
    providerNet: subtotal,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatMoney(amount: number, currency = 'EUR'): string {
  const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency + ' ';
  return `${symbol}${amount.toFixed(2)}`;
}
