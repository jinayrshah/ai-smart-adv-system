// Fails when a language file is missing keys that en.json has, or uses a different {{placeholder}}.
import { readFileSync, readdirSync } from 'node:fs';

const dir = new URL('../src/i18n/locales/', import.meta.url);
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) =>
  v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, String(v)]]);
const load = (f) => new Map(flat(JSON.parse(readFileSync(new URL(f, dir), 'utf8'))));
const vars = (s) => [...s.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort().join(',');

const en = load('en.json');
let bad = 0;
for (const f of readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'en.json')) {
  const loc = load(f);
  for (const [key, text] of en) {
    if (!loc.has(key)) { console.error(`${f}: missing "${key}"`); bad++; }
    else if (vars(loc.get(key)) !== vars(text)) { console.error(`${f}: "${key}" placeholders differ from en.json`); bad++; }
  }
}
if (bad) { console.error(`${bad} translation problem(s)`); process.exit(1); }
console.log('All language files match en.json');
