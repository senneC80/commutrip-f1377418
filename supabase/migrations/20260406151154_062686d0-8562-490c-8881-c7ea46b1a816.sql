
-- Add commission_amount to bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS commission_amount numeric;

-- Create reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  traveller_id uuid NOT NULL,
  provider_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (booking_id)
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Travellers can create reviews for their own bookings
CREATE POLICY "Travellers can create own reviews"
  ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = traveller_id);

-- Anyone authenticated can read reviews
CREATE POLICY "Anyone can read reviews"
  ON public.reviews FOR SELECT TO authenticated
  USING (true);

-- Travellers can update own reviews
CREATE POLICY "Travellers can update own reviews"
  ON public.reviews FOR UPDATE TO authenticated
  USING (auth.uid() = traveller_id)
  WITH CHECK (auth.uid() = traveller_id);
