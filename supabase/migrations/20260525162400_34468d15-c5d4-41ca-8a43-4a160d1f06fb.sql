CREATE OR REPLACE FUNCTION public.create_booking_with_topup(
  _activity_id uuid,
  _provider_id uuid,
  _booking_date date,
  _participants integer,
  _total_price numeric,
  _commission_amount numeric,
  _topup_amount numeric DEFAULT 0,
  _fund_id uuid DEFAULT NULL,
  _topup_currency text DEFAULT 'EUR'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_booking_id uuid;
  v_uid uuid := auth.uid();
  v_max_participants integer;
  v_existing_total integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _participants <= 0 THEN
    RAISE EXCEPTION 'Participants must be greater than zero';
  END IF;

  SELECT max_participants INTO v_max_participants
  FROM public.activities
  WHERE id = _activity_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Activity not found';
  END IF;

  SELECT COALESCE(SUM(participants), 0) INTO v_existing_total
  FROM public.bookings
  WHERE activity_id = _activity_id
    AND booking_date = _booking_date
    AND status IN ('pending', 'confirmed', 'completed');

  IF v_max_participants IS NOT NULL
     AND v_existing_total + _participants > v_max_participants THEN
    RAISE EXCEPTION 'Capacity exceeded: % of % seats remaining',
      GREATEST(v_max_participants - v_existing_total, 0),
      v_max_participants;
  END IF;

  INSERT INTO public.bookings (activity_id, traveller_id, provider_id, booking_date, participants, total_price, commission_amount, status)
  VALUES (_activity_id, v_uid, _provider_id, _booking_date, _participants, _total_price, _commission_amount, 'pending')
  RETURNING id INTO v_booking_id;

  IF _topup_amount > 0 THEN
    IF _fund_id IS NULL THEN
      RAISE EXCEPTION 'fund_id required when topup_amount > 0';
    END IF;
    INSERT INTO public.fund_contributions (fund_id, source_type, contributor_id, booking_id, amount, currency)
    VALUES (_fund_id, 'traveller_topup', v_uid, v_booking_id, _topup_amount, _topup_currency);
  END IF;

  RETURN v_booking_id;
END;
$$;
