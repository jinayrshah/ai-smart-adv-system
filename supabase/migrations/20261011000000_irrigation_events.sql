-- Irrigation log: lets the FAO-56 root-zone water balance (advisory §8) add back the
-- water a farmer actually applied. Without it the balance can only assume nothing was
-- irrigated since sowing.
create table if not exists irrigation_events (
  id            bigserial primary key,
  farm_id       bigint not null references farms(id) on delete cascade,
  farm_crop_id  bigint references farm_crops(id) on delete set null,
  irrigated_on  date not null,
  amount_mm     numeric(6,1) not null check (amount_mm > 0 and amount_mm <= 300),
  method        text,
  note          text,
  created_at    timestamptz not null default now()
);

create index if not exists irrigation_events_farm_date_idx on irrigation_events (farm_id, irrigated_on desc);

alter table irrigation_events enable row level security;

drop policy if exists "Users can view own irrigation events" on irrigation_events;
create policy "Users can view own irrigation events" on irrigation_events
  for select using (
    exists (select 1 from farms where farms.id = irrigation_events.farm_id and farms.farmer_id = auth.uid())
  );

drop policy if exists "Users can insert own irrigation events" on irrigation_events;
create policy "Users can insert own irrigation events" on irrigation_events
  for insert with check (
    exists (select 1 from farms where farms.id = irrigation_events.farm_id and farms.farmer_id = auth.uid())
  );

drop policy if exists "Users can delete own irrigation events" on irrigation_events;
create policy "Users can delete own irrigation events" on irrigation_events
  for delete using (
    exists (select 1 from farms where farms.id = irrigation_events.farm_id and farms.farmer_id = auth.uid())
  );
