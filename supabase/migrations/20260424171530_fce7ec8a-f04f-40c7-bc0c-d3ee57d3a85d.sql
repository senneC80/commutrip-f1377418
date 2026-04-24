
DO $$
DECLARE
  v_fund_id UUID;
  v_kyoto UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_p1 UUID := '22222222-2222-2222-2222-222222222222';
  v_p2 UUID := '44444444-4444-4444-4444-444444444444';
  v_traveller UUID;
BEGIN
  -- Pick any traveller user for top-ups
  SELECT user_id INTO v_traveller FROM user_roles WHERE role = 'traveller' LIMIT 1;
  IF v_traveller IS NULL THEN v_traveller := v_p1; END IF;

  -- Create fund
  INSERT INTO public.community_funds (community_id, description, purpose, target_amount, currency, show_history_publicly)
  VALUES (
    v_kyoto,
    'A shared fund supporting Kyoto craft apprentices and community heritage projects.',
    'Tuition support for young apprentices learning traditional crafts (lacquerware, indigo dyeing, kintsugi) and small heritage-site upkeep grants.',
    10000,
    'EUR',
    true
  )
  ON CONFLICT (community_id) DO UPDATE SET description = EXCLUDED.description
  RETURNING id INTO v_fund_id;

  -- Provider contributions
  INSERT INTO public.fund_contributions (fund_id, source_type, contributor_id, amount, currency, created_at)
  VALUES
    (v_fund_id, 'provider_pledge', v_p1, 45.00, 'EUR', now() - interval '21 days'),
    (v_fund_id, 'provider_pledge', v_p2, 30.00, 'EUR', now() - interval '14 days'),
    (v_fund_id, 'provider_pledge', v_p1, 60.00, 'EUR', now() - interval '6 days');

  -- Traveller top-ups
  INSERT INTO public.fund_contributions (fund_id, source_type, contributor_id, amount, currency, created_at)
  VALUES
    (v_fund_id, 'traveller_topup', v_traveller, 5.00, 'EUR', now() - interval '12 days'),
    (v_fund_id, 'traveller_topup', v_traveller, 10.00, 'EUR', now() - interval '3 days');

  -- Impact report
  INSERT INTO public.impact_reports (community_id, author_id, title, body, metrics, status, published_at)
  VALUES (
    v_kyoto,
    v_p1,
    'Spring 2026: Apprentice cohort welcomed',
    E'## A milestone season\n\nThanks to traveller and provider contributions, **three new apprentices** joined our heritage craft program this spring. Funds covered tuition, materials, and a stipend for the first four months.\n\nWe also completed minor restoration work at one of our partner workshops.\n\n*Full financials available on request.*',
    '[{"label":"Amount raised","value":"€2,300"},{"label":"Apprentices supported","value":"3"},{"label":"Families benefitting","value":"14"}]'::jsonb,
    'published',
    now() - interval '5 days'
  );
END $$;
