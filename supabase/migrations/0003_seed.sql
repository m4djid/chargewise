-- 0003_seed.sql — eMSP + plan catalogue seed (spec §7.1, Block 0.1).
-- Top 10 eMSPs active on the French market, 25 subscription tiers.
-- Plan ids are contractual: lib/chargeprice-id-map.ts maps Chargeprice
-- provider ids onto these exact slugs — do not rename.
-- Fees are July 2026 best-effort estimates; tariff pricing itself lives in
-- the tariffs table (data/tariffs-seed.csv via scripts/import-tariffs.ts).

-- ---------------------------------------------------------------------------
-- emsps
-- ---------------------------------------------------------------------------
INSERT INTO public.emsps (id, display_name, website_url, country_codes) VALUES
  ('chargemap-pass',  'Chargemap Pass',          'https://chargemap.com',            ARRAY['FR','BE','DE','NL','ES','IT','CH','LU']),
  ('plugsurfing',     'Plugsurfing',             'https://plugsurfing.com',          ARRAY['FR','DE','NL','BE','AT','SE','NO','FI']),
  ('ionity',          'IONITY Passport',         'https://ionity.eu',                ARRAY['FR','DE','NL','BE','AT','IT','ES','CH']),
  ('totalenergies',   'TotalEnergies Charge',    'https://services.totalenergies.fr', ARRAY['FR','BE','NL','DE','LU']),
  ('freshmile',       'Freshmile',               'https://freshmile.com',            ARRAY['FR','BE','LU','CH']),
  ('electra',         'Electra',                 'https://electra.com',              ARRAY['FR','BE','IT','ES','CH','AT','DE','LU']),
  ('becharge',        'Be Charge',               'https://bec.energy',               ARRAY['FR','IT','ES','PT','BE']),
  ('enelxway',        'Enel X Way',              'https://enelxway.com',             ARRAY['FR','IT','ES','DE']),
  ('shell-recharge',  'Shell Recharge',          'https://shellrecharge.com',        ARRAY['FR','DE','NL','BE','GB','LU']),
  ('maingau',         'Maingau Energie',         'https://maingau-energie.de',       ARRAY['DE','FR','AT','BE','NL','LU','CH'])
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- emsp_plans — 25 tiers (NULL monthly fee = free / pay-as-you-go)
-- ---------------------------------------------------------------------------
INSERT INTO public.emsp_plans (id, emsp_id, display_name, monthly_fee_eur, annual_fee_eur, description) VALUES
  -- Chargemap Pass (3)
  ('chargemap-pass-gratuit',  'chargemap-pass', 'Pass Gratuit',        NULL,  NULL,   'Free Chargemap Pass badge, pay-as-you-go roaming.'),
  ('chargemap-pass-pro',      'chargemap-pass', 'Pass Pro',            4.99,  49.90,  'Reduced kWh pricing on partner networks.'),
  ('chargemap-pass-business', 'chargemap-pass', 'Pass Business',       9.99,  99.90,  'Fleet badge with consolidated billing and reduced roaming rates.'),
  -- Plugsurfing (3)
  ('plugsurfing-go',          'plugsurfing',    'Go',                  NULL,  NULL,   'Pay-as-you-go RFID key, no subscription.'),
  ('plugsurfing-plus',        'plugsurfing',    'Plus',                7.99,  NULL,   'Subscription with discounted fast-charging rates.'),
  ('plugsurfing-business',    'plugsurfing',    'Business',            12.99, NULL,   'B2B plan with fleet management and invoicing.'),
  -- IONITY Passport (4)
  ('ionity-standard',         'ionity',         'Passport Standard',   NULL,  NULL,   'Direct IONITY access without subscription.'),
  ('ionity-motion',           'ionity',         'Passport Motion',     5.99,  NULL,   'Light subscription, mid discount on IONITY network.'),
  ('ionity-power',            'ionity',         'Passport Power',      11.99, NULL,   'Heavy-user subscription, best IONITY kWh price.'),
  ('ionity-plus',             'ionity',         'IONITY+',             17.99, NULL,   'Premium plan, lowest per-kWh price on IONITY HPC.'),
  -- TotalEnergies (2)
  ('totalenergies-standard',  'totalenergies',  'Charge Standard',     NULL,  NULL,   'Free TotalEnergies charge card.'),
  ('totalenergies-plus',      'totalenergies',  'Charge Plus',         2.99,  NULL,   'Subscription with reduced pricing on TotalEnergies hubs.'),
  -- Freshmile (2)
  ('freshmile-standard',      'freshmile',      'Standard',            NULL,  NULL,   'Free Freshmile account, pay-as-you-go.'),
  ('freshmile-pro',           'freshmile',      'Pro',                 6.99,  NULL,   'Professional plan with discounted Freshmile network rates.'),
  -- Electra (3)
  ('electra-standard',        'electra',        'Standard',            NULL,  NULL,   'Electra app pricing without subscription.'),
  ('electra-abonnement',      'electra',        'Abonnement',          4.99,  NULL,   'Electra subscription: reduced kWh price on all Electra hubs.'),
  ('electra-pro',             'electra',        'Pro',                 14.99, NULL,   'High-mileage plan, lowest Electra kWh price.'),
  -- Be Charge (2)
  ('becharge-standard',       'becharge',       'Standard',            NULL,  NULL,   'Free Be Charge account.'),
  ('becharge-plus',           'becharge',       'Plus',                7.90,  NULL,   'Subscription with kWh packages and discounts.'),
  -- Enel X Way (2)
  ('enelxway-standard',       'enelxway',       'Standard',            NULL,  NULL,   'Pay-as-you-go via Enel X Way app.'),
  ('enelxway-plus',           'enelxway',       'Plus',                9.99,  NULL,   'Subscription with discounted roaming rates.'),
  -- Shell Recharge (2)
  ('shell-recharge-standard', 'shell-recharge', 'Standard',            NULL,  NULL,   'Free Shell Recharge card, pay-as-you-go.'),
  ('shell-recharge-plus',     'shell-recharge', 'Plus',                5.99,  NULL,   'Subscription with reduced HPC rates on partner networks.'),
  -- Maingau (2)
  ('maingau-standard',        'maingau',        'EinfachStromLaden',   NULL,  NULL,   'Maingau standard roaming tariff.'),
  ('maingau-autostrom',       'maingau',        'Autostrom Plus',      5.99,  NULL,   'Discounted rates for Maingau energy customers.')
ON CONFLICT (id) DO NOTHING;
