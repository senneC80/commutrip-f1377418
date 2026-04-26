
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
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
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
