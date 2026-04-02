
-- Add columns to trip_stops
ALTER TABLE public.trip_stops ADD COLUMN IF NOT EXISTS arrival_date date;
ALTER TABLE public.trip_stops ADD COLUMN IF NOT EXISTS departure_date date;

-- Add provider_id to bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS provider_id uuid;

-- Add lat/lng and interest_tags and scheduling columns to activities
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS interest_tags text[] DEFAULT '{}'::text[];
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS start_hour time;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS recurrence_type text DEFAULT 'one-time';
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS schedule_days text[] DEFAULT '{}'::text[];
