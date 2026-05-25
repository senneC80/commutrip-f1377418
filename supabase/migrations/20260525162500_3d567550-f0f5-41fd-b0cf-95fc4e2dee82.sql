-- 1. Booking status enum
DO $$
BEGIN
  CREATE TYPE public.booking_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Convert bookings.status from TEXT to enum
ALTER TABLE public.bookings ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.bookings
  ALTER COLUMN status TYPE public.booking_status
  USING status::public.booking_status;

ALTER TABLE public.bookings
  ALTER COLUMN status SET DEFAULT 'pending'::public.booking_status;

ALTER TABLE public.bookings ALTER COLUMN status SET NOT NULL;

-- 3. Transition validation function. Fires BEFORE UPDATE, named with an
-- `a_` prefix so it runs before `bookings_completed_pledge` (PostgreSQL
-- fires same-timing triggers in alphabetical name order).
CREATE OR REPLACE FUNCTION public.validate_booking_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF (OLD.status = 'pending'   AND NEW.status IN ('confirmed', 'cancelled', 'completed'))
  OR (OLD.status = 'confirmed' AND NEW.status IN ('completed', 'cancelled')) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid booking status transition: % -> %', OLD.status, NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS a_validate_booking_status_transition ON public.bookings;
CREATE TRIGGER a_validate_booking_status_transition
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.validate_booking_status_transition();
