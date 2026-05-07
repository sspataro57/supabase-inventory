-- ── Units ───────────────────────────────────────────────────────────────────

-- Mass (base: gram)
insert into units (code, measure_type, to_base_factor, display_name, system) values
  ('g',   'mass', 1,          'Gram',           'si'),
  ('kg',  'mass', 1000,       'Kilogram',        'si'),
  ('mg',  'mass', 0.001,      'Milligram',       'si'),
  ('oz',  'mass', 28.3495,    'Ounce',           'imperial'),
  ('lb',  'mass', 453.592,    'Pound',           'imperial');

-- Volume (base: milliliter)
insert into units (code, measure_type, to_base_factor, display_name, system) values
  ('ml',      'volume', 1,          'Milliliter',        'si'),
  ('l',       'volume', 1000,       'Liter',             'si'),
  ('fl_oz_us','volume', 29.5735,    'Fluid Ounce (US)',  'imperial'),
  ('gal_us',  'volume', 3785.41,    'Gallon (US)',       'imperial'),
  ('tsp',     'volume', 4.92892,    'Teaspoon',          'imperial'),
  ('tbsp',    'volume', 14.7868,    'Tablespoon',        'imperial'),
  ('cup_us',  'volume', 236.588,    'Cup (US)',          'imperial');

-- Count (base: each)
insert into units (code, measure_type, to_base_factor, display_name, system) values
  ('ea',     'count', 1,   'Each',   'si'),
  ('dozen',  'count', 12,  'Dozen',  'si');

-- ── Preferences (singleton row) ──────────────────────────────────────────────
insert into preferences (
  id,
  default_unit_mass,
  default_unit_volume,
  default_unit_count
) values (1, 'g', 'ml', 'ea')
on conflict (id) do nothing;
