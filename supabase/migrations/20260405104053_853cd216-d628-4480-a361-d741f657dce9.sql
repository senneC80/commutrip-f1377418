
-- Tokyo activities → Senne Tokyo
UPDATE activities SET provider_id = 'ccfea7b8-6341-43e7-8753-225393af3602'
WHERE provider_id = '11111111-1111-1111-1111-111111111111';

-- Kyoto activities → Senne Kyoto
UPDATE activities SET provider_id = '7df39e4d-1e38-4ac6-83d0-e03f756771cf'
WHERE provider_id = '22222222-2222-2222-2222-222222222222';

-- Osaka activities → Senne Osaka
UPDATE activities SET provider_id = '131efb35-f5f4-48d0-aca8-969d439ed23b'
WHERE provider_id = '33333333-3333-3333-3333-333333333333';

-- Hiroshima + Nara + Calligraphy → Senne Hiroshima
UPDATE activities SET provider_id = '7c206617-5c37-4463-96c4-1cb2ae32dc4f'
WHERE provider_id = '44444444-4444-4444-4444-444444444444';
