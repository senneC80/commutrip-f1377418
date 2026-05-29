-- Anchor every booking at a Trip Stop.
--
-- Ontology change: Booking now mediates Trip Stop. Provider is derivable via
-- Activity Listing, but bookings.provider_id is kept as a denormalisation
-- for query and RLS convenience.
--
-- Reversal: drop trigger, drop function, drop column trip_stop_id, restore
-- the previous create_booking_with_topup signature, restore the previous
-- get_recommended_activities body (see git history).

-- 1. Add trip_stop_id (nullable for backfill)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS trip_stop_id uuid
  REFERENCES public.trip_stops(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_bookings_trip_stop ON public.bookings(trip_stop_id);

-- 2. Backfill: best-effort match by traveller + booking_date within a stop's range
UPDATE public.bookings b
SET trip_stop_id = (
  SELECT ts.id
  FROM public.trip_stops ts
  JOIN public.trips t ON t.id = ts.trip_id
  WHERE t.user_id = b.traveller_id
    AND ts.arrival_date IS NOT NULL
    AND ts.departure_date IS NOT NULL
    AND b.booking_date BETWEEN ts.arrival_date AND ts.departure_date
  ORDER BY ts.arrival_date
  LIMIT 1
)
WHERE b.trip_stop_id IS NULL;

-- 3. Drop orphan bookings whose date falls outside every stop the traveller owns.
--    Cascade dependents manually (reviews has FK NO ACTION; fund_contributions
--    has no FK on booking_id but references it logically).
DO $$
DECLARE
  v_orphan_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_orphan_ids
  FROM public.bookings
  WHERE trip_stop_id IS NULL;

  IF v_orphan_ids IS NOT NULL AND array_length(v_orphan_ids, 1) > 0 THEN
    RAISE NOTICE 'Deleting % orphan booking(s) without a matching trip stop: %',
      array_length(v_orphan_ids, 1), v_orphan_ids;
    DELETE FROM public.reviews            WHERE booking_id = ANY(v_orphan_ids);
    DELETE FROM public.fund_contributions WHERE booking_id = ANY(v_orphan_ids);
    DELETE FROM public.bookings           WHERE id         = ANY(v_orphan_ids);
  END IF;
END $$;

-- 4. NOT NULL
ALTER TABLE public.bookings ALTER COLUMN trip_stop_id SET NOT NULL;

-- 5. Trigger: booking_date must fall within the referenced stop's range,
--    and the stop must belong to a trip owned by the traveller.
CREATE OR REPLACE FUNCTION public.validate_booking_anchored_at_stop()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_arrival   date;
  v_departure date;
  v_owner     uuid;
BEGIN
  SELECT ts.arrival_date, ts.departure_date, t.user_id
  INTO v_arrival, v_departure, v_owner
  FROM public.trip_stops ts
  JOIN public.trips t ON t.id = ts.trip_id
  WHERE ts.id = NEW.trip_stop_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Trip stop % not found', NEW.trip_stop_id;
  END IF;

  IF v_owner <> NEW.traveller_id THEN
    RAISE EXCEPTION 'Trip stop % does not belong to traveller %', NEW.trip_stop_id, NEW.traveller_id;
  END IF;

  IF v_arrival IS NULL OR v_departure IS NULL THEN
    RAISE EXCEPTION 'Trip stop % must have arrival_date and departure_date set before bookings can be anchored at it', NEW.trip_stop_id;
  END IF;

  IF NEW.booking_date < v_arrival OR NEW.booking_date > v_departure THEN
    RAISE EXCEPTION 'Booking date % is outside trip stop range [%, %]',
      NEW.booking_date, v_arrival, v_departure;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS b_validate_booking_anchored_at_stop ON public.bookings;
CREATE TRIGGER b_validate_booking_anchored_at_stop
BEFORE INSERT OR UPDATE OF booking_date, trip_stop_id, traveller_id ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.validate_booking_anchored_at_stop();

-- 6. create_booking_with_topup: add _trip_stop_id parameter and persist it.
--    Parameter list changes, so drop + recreate (CREATE OR REPLACE can't add params).
DROP FUNCTION IF EXISTS public.create_booking_with_topup(uuid, uuid, date, integer, numeric, numeric, numeric, uuid, text);

CREATE FUNCTION public.create_booking_with_topup(
  _activity_id uuid,
  _provider_id uuid,
  _trip_stop_id uuid,
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

  IF _trip_stop_id IS NULL THEN
    RAISE EXCEPTION 'trip_stop_id is required: every booking must be anchored at a trip stop';
  END IF;

  -- Capacity check (locks the activity row)
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

  -- Stop ownership + date-range validation is handled by the
  -- b_validate_booking_anchored_at_stop trigger on INSERT.
  INSERT INTO public.bookings (
    activity_id, traveller_id, provider_id, trip_stop_id,
    booking_date, participants, total_price, commission_amount, status
  )
  VALUES (
    _activity_id, v_uid, _provider_id, _trip_stop_id,
    _booking_date, _participants, _total_price, _commission_amount, 'pending'
  )
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

GRANT EXECUTE ON FUNCTION public.create_booking_with_topup(uuid, uuid, uuid, date, integer, numeric, numeric, numeric, uuid, text) TO authenticated;

-- 7. get_recommended_activities: intersect schedule_days with the stop's date
--    range instead of merely checking that the array is non-empty.
CREATE OR REPLACE FUNCTION public.get_recommended_activities(
  _stop_lat double precision,
  _stop_lng double precision,
  _arrival_date date,
  _departure_date date,
  _traveller_tags text[] DEFAULT '{}'::text[],
  _radius_km double precision DEFAULT 50.0,
  _limit_count integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  location text,
  latitude double precision,
  longitude double precision,
  price numeric,
  currency text,
  max_participants integer,
  start_hour time,
  duration_minutes integer,
  recurrence_type text,
  schedule_days text[],
  event_date date,
  available_from date,
  available_until date,
  interest_tags text[],
  image_url text,
  provider_id uuid,
  distance_km double precision,
  tag_match_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id, a.title, a.description, a.location, a.latitude, a.longitude,
    a.price, a.currency, a.max_participants, a.start_hour, a.duration_minutes,
    a.recurrence_type, a.schedule_days, a.event_date, a.available_from,
    a.available_until, a.interest_tags, a.image_url, a.provider_id,
    (point(a.longitude, a.latitude) <@> point(_stop_lng, _stop_lat)) * 1.609344 AS distance_km,
    COALESCE(array_length(
      ARRAY(SELECT unnest(a.interest_tags) INTERSECT SELECT unnest(_traveller_tags)),
      1
    ), 0) AS tag_match_count
  FROM activities a
  WHERE a.is_active = true
    AND a.latitude IS NOT NULL
    AND a.longitude IS NOT NULL
    AND (point(a.longitude, a.latitude) <@> point(_stop_lng, _stop_lat)) * 1.609344 <= _radius_km
    AND (
      -- One-time event whose date falls within the stop window
      (a.recurrence_type = 'one-time' AND a.event_date IS NOT NULL
        AND a.event_date >= _arrival_date AND a.event_date <= _departure_date)
      OR
      -- Recurring: window overlaps AND at least one schedule day falls within the stop
      (a.recurrence_type = 'recurring'
        AND a.available_from IS NOT NULL
        AND a.available_from <= _departure_date
        AND (a.available_until IS NULL OR a.available_until >= _arrival_date)
        AND a.schedule_days IS NOT NULL
        AND array_length(a.schedule_days, 1) > 0
        AND EXISTS (
          SELECT 1
          FROM generate_series(_arrival_date::timestamp, _departure_date::timestamp, '1 day'::interval) AS dt
          WHERE (ARRAY['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])[EXTRACT(dow FROM dt)::int + 1]
                = ANY (a.schedule_days)
        )
      )
      OR
      -- Caller passed no window — show all in radius
      (_arrival_date IS NULL OR _departure_date IS NULL)
    )
  ORDER BY tag_match_count DESC, distance_km ASC
  LIMIT _limit_count;
$$;
