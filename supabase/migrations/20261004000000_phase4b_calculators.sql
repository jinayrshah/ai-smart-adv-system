-- Migration: 20261004000000_phase4b_calculators.sql
-- Phase 4B: Crop Cost Reference & Crop Storage Reference (Architecture §9b)

create table if not exists crop_cost_reference (
  crop                            text not null,
  state                           text not null,
  year                            text not null,                    -- e.g. '2022-23'
  cost_a2fl_per_quintal           numeric(10,2),
  cost_c2_per_quintal             numeric(10,2) not null,
  reference_yield_qtl_per_hectare numeric(8,2) not null,
  source                          text not null default 'DES Cost of Cultivation Scheme',
  primary key (crop, state, year)
);

create table if not exists crop_storage_reference (
  crop                        text primary key,
  storable                    boolean not null,
  max_storage_days            smallint,
  typical_loss_pct_per_month  numeric(4,1),
  source                      text not null
);

-- Enable RLS
alter table crop_cost_reference enable row level security;
alter table crop_storage_reference enable row level security;

-- Grants for service_role
grant all on crop_cost_reference to service_role;
grant all on crop_storage_reference to service_role;
