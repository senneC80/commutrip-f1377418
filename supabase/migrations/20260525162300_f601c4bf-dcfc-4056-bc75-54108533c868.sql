-- Reviews INSERT must require a completed booking owned by the reviewer.
DROP POLICY IF EXISTS "Travellers can create own reviews" ON public.reviews;

CREATE POLICY "Travellers can create own reviews"
  ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = traveller_id
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
        AND b.traveller_id = auth.uid()
        AND b.status = 'completed'
    )
  );
