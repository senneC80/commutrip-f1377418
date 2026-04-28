-- Fix 1: harden handle_new_user to ignore client-supplied role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'traveller') IN ('traveller', 'provider')
        THEN (NEW.raw_user_meta_data->>'role')::app_role
      ELSE 'traveller'::app_role
    END
  );

  RETURN NEW;
END;
$function$;

-- Fix 2: split bookings traveller FOR ALL policy into SELECT/INSERT/UPDATE only
DROP POLICY IF EXISTS "Travellers can manage own bookings" ON public.bookings;

CREATE POLICY "Travellers can read own bookings"
ON public.bookings
FOR SELECT
TO authenticated
USING (auth.uid() = traveller_id);

CREATE POLICY "Travellers can create own bookings"
ON public.bookings
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = traveller_id);

CREATE POLICY "Travellers can update own bookings"
ON public.bookings
FOR UPDATE
TO authenticated
USING (auth.uid() = traveller_id)
WITH CHECK (auth.uid() = traveller_id);
