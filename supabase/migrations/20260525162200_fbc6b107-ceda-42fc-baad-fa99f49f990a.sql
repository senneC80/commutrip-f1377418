-- Provider-facing RPC to mark a booking completed.
-- Bypasses RLS via SECURITY DEFINER and encodes the authorization
-- rule (caller must be the provider of the booking's activity) that
-- the bookings UPDATE policy cannot express.
CREATE OR REPLACE FUNCTION public.mark_booking_completed(_booking_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_provider_id uuid;
  v_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT a.provider_id, b.status
  INTO v_provider_id, v_status
  FROM public.bookings b
  JOIN public.activities a ON a.id = b.activity_id
  WHERE b.id = _booking_id;

  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_provider_id <> v_uid THEN
    RAISE EXCEPTION 'Only the activity provider can mark this booking completed';
  END IF;

  IF v_status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'Booking cannot be completed from status %', v_status;
  END IF;

  UPDATE public.bookings
  SET status = 'completed', completed_at = now()
  WHERE id = _booking_id;

  RETURN _booking_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_booking_completed(uuid) TO authenticated;
