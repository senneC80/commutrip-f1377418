-- Seed admin user
DO $$
DECLARE
  admin_uid UUID := '99999999-9999-9999-9999-999999999999';
  hashed_pw TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = admin_uid) THEN
    hashed_pw := crypt('AdminPass123!', gen_salt('bf'));
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', admin_uid, 'authenticated', 'authenticated',
      'admin@commutrip.test', hashed_pw, now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"first_name":"Platform","last_name":"Admin","role":"admin"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), admin_uid,
      jsonb_build_object('sub', admin_uid::text, 'email', 'admin@commutrip.test'),
      'email', admin_uid::text, now(), now(), now());
  END IF;

  -- Ensure profile + admin role rows exist
  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (admin_uid, 'Platform', 'Admin')
  ON CONFLICT DO NOTHING;

  -- Remove any other roles for this user, then add admin
  DELETE FROM public.user_roles WHERE user_id = admin_uid;
  INSERT INTO public.user_roles (user_id, role) VALUES (admin_uid, 'admin');

  -- Seed: Kyoto Cultural Providers = approved
  IF NOT EXISTS (
    SELECT 1 FROM public.community_verifications
    WHERE community_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND status = 'approved'
  ) THEN
    INSERT INTO public.community_verifications (
      community_id, submitter_id, ownership_type, revenue_distribution,
      certifications, narrative, status, reviewer_id, reviewer_notes, decided_at
    ) VALUES (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '22222222-2222-2222-2222-222222222222',
      'cooperative',
      'Revenue is split equally among the 12 member artisan families with 10% reinvested in community heritage projects.',
      'Member of Japan Sustainable Tourism Network',
      'Our cooperative was founded in 1998 by Kyoto-born craftspeople committed to preserving traditional arts and ensuring tourism directly supports the families who keep these traditions alive.',
      'approved',
      '99999999-9999-9999-9999-999999999999',
      'Strong evidence of cooperative ownership and equitable revenue distribution. Approved.',
      now() - interval '7 days'
    );
  END IF;

  -- Seed: Osaka Food Collective = pending
  IF NOT EXISTS (
    SELECT 1 FROM public.community_verifications
    WHERE community_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' AND status = 'pending'
  ) THEN
    INSERT INTO public.community_verifications (
      community_id, submitter_id, ownership_type, revenue_distribution,
      certifications, narrative, status
    ) VALUES (
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      '33333333-3333-3333-3333-333333333333',
      'village_association',
      '70% goes directly to participating food vendors and home cooks; 20% funds collective marketing; 10% supports local food security programs.',
      'Osaka Slow Food Chapter member',
      'We are a network of family-run kitchens, market vendors and home cooks across three Osaka neighborhoods who came together in 2021 to offer travellers authentic, neighborhood-rooted food experiences.',
      'pending'
    );
  END IF;
END $$;
