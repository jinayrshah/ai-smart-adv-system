-- Fix duplicate markets stored under two spellings ("APMC Malegaon" vs "Malegaon",
-- "Shahada" vs "APMC Shahada"; cleanup doc P2, Revisions §2.7). Ingestion now strips the
-- APMC prefix/suffix (app/data/mandi/canonical.clean_market_name); this migration applies
-- the same rule to rows written before that, keeping the higher-priority row when both
-- spellings exist for the same natural key.

create or replace function clean_market_name(m text)
returns text
language sql
immutable
as $$
  select btrim(regexp_replace(regexp_replace(regexp_replace(coalesce(m, ''),
           '^\s*apmc\s+', '', 'i'),
           '\s+apmc\s*$', '', 'i'),
           '\s+', ' ', 'g'))
$$;

-- 1. Where both spellings exist for one (state, district, market, commodity, variety,
--    grade, arrival_date), delete the lower-priority row (ties: keep the older id).
delete from mandi_prices a
using mandi_prices b
where a.id <> b.id
  and a.state = b.state
  and a.district = b.district
  and a.commodity = b.commodity
  and a.variety = b.variety
  and a.grade = b.grade
  and a.arrival_date = b.arrival_date
  and clean_market_name(a.market) = clean_market_name(b.market)
  and (a.source_priority < b.source_priority
       or (a.source_priority = b.source_priority and a.id > b.id));

-- 2. Rename the survivors to the clean spelling.
update mandi_prices
set market = clean_market_name(market)
where market <> clean_market_name(market);

-- 3. Same for the explore watch-list (drop the alias row if the clean one exists).
delete from mandi_watch a
using mandi_watch b
where a.id <> b.id
  and a.state = b.state
  and a.commodity = b.commodity
  and a.district = b.district
  and clean_market_name(a.market) = clean_market_name(b.market)
  and a.market <> clean_market_name(a.market)
  and (b.market = clean_market_name(b.market) or a.id > b.id);

update mandi_watch
set market = clean_market_name(market)
where market <> clean_market_name(market);
