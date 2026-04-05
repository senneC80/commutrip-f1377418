
-- Enable earthdistance extension for proximity calculations
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- Create a function to get recommended activities for a trip stop
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
    a.id,
    a.title,
    a.description,
    a.location,
    a.latitude,
    a.longitude,
    a.price,
    a.currency,
    a.max_participants,
    a.start_hour,
    a.duration_minutes,
    a.recurrence_type,
    a.schedule_days,
    a.event_date,
    a.available_from,
    a.available_until,
    a.interest_tags,
    a.image_url,
    a.provider_id,
    -- Calculate distance in km
    (point(a.longitude, a.latitude) <@> point(_stop_lng, _stop_lat)) * 1.609344 AS distance_km,
    -- Count matching tags
    COALESCE(array_length(
      ARRAY(
        SELECT unnest(a.interest_tags)
        INTERSECT
        SELECT unnest(_traveller_tags)
      ), 1
    ), 0) AS tag_match_count
  FROM activities a
  WHERE a.is_active = true
    AND a.latitude IS NOT NULL
    AND a.longitude IS NOT NULL
    -- Distance filter (earth_distance returns miles, convert to km)
    AND (point(a.longitude, a.latitude) <@> point(_stop_lng, _stop_lat)) * 1.609344 <= _radius_km
    -- Date overlap logic
    AND (
      -- One-time: event_date between arrival and departure
      (a.recurrence_type = 'one-time' AND a.event_date IS NOT NULL
        AND a.event_date >= _arrival_date AND a.event_date <= _departure_date)
      OR
      -- Recurring: date range overlaps AND schedule days match
      (a.recurrence_type = 'recurring'
        AND a.available_from IS NOT NULL
        AND a.available_from <= _departure_date
        AND (a.available_until IS NULL OR a.available_until >= _arrival_date)
        AND a.schedule_days IS NOT NULL
        AND array_length(a.schedule_days, 1) > 0
      )
      OR
      -- If no dates provided, show all
      (_arrival_date IS NULL OR _departure_date IS NULL)
    )
  ORDER BY tag_match_count DESC, distance_km ASC
  LIMIT _limit_count;
$$;
