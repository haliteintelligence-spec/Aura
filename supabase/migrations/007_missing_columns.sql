-- Add perfume_names to layer_combos (stores names at save time, survives closet edits)
alter table public.layer_combos
  add column if not exists perfume_names text[] default '{}';

-- Add event_types to scent_logs (multi-select occasions; event_type kept for backwards compat)
alter table public.scent_logs
  add column if not exists event_types text[] default '{}';
