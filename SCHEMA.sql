-- ============================================================
-- Predicción NBA — Schema Supabase (tablas nba_* independientes)
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- ============================================================

-- Predicciones de cada usuario (clave-valor flexible)
create table if not exists nba_predicciones (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  game_id text not null,
  key text not null,          -- 'winner', 'q1_local', 'q1_visit', ...
  value text,
  updated_at timestamptz default now(),
  unique(user_id, game_id, key)
);

-- Resultados reales del partido
create table if not exists nba_resultados (
  id text primary key,         -- '<game_id>_<key>'
  game_id text not null,
  key text not null,
  value text,
  status text default 'SCHEDULED',  -- SCHEDULED | LIVE | FINISHED
  updated_at timestamptz default now()
);

-- Realtime
alter publication supabase_realtime add table nba_resultados;

-- RLS
alter table nba_predicciones enable row level security;
alter table nba_resultados enable row level security;

create policy "nba_pred_read"   on nba_predicciones for select using (auth.role() = 'authenticated');
create policy "nba_pred_insert" on nba_predicciones for insert with check (auth.uid() = user_id);
create policy "nba_pred_update" on nba_predicciones for update using (auth.uid() = user_id);
create policy "nba_res_read"    on nba_resultados   for select using (auth.role() = 'authenticated');

-- Permitir que el admin escriba resultados desde la app (por email)
create policy "nba_res_admin" on nba_resultados for all
  using ((auth.jwt() ->> 'email') = 'pablocrovetto87@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'pablocrovetto87@gmail.com');
