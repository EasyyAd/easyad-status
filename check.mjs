// Un passage de vérification : appelle chaque service, met à jour status.json, prévient l'équipe des changements.
// Usage : node check.mjs <ancien status.json> <nouveau status.json>
import fs from 'node:fs';
import { alertText, evaluate, merge } from './lib.mjs';

const [, , prevPath, outPath] = process.argv;
const config = JSON.parse(fs.readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
const TIMEOUT = 10_000;

async function hit(url, expect) {
  const t = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT), redirect: 'follow', headers: { 'User-Agent': 'EasyAd-Status/1.0 (+https://status.easyyad.com)' } });
    const body = await res.text();
    return { ok: res.ok && (!expect || body.includes(expect)), status: res.status, ms: Date.now() - t, body };
  } catch (e) {
    return { ok: false, status: null, ms: Date.now() - t, error: e.name };
  }
}

/** Un échec est revérifié une fois, quelques secondes plus tard : un hoquet réseau n'est pas une panne. */
async function check(url, expect) {
  const first = await hit(url, expect);
  if (first.ok) return first;
  await new Promise((r) => setTimeout(r, 5000));
  return hit(url, expect);
}

const http = {};
await Promise.all(config.components.filter((c) => c.url).map(async (c) => { http[c.id] = await check(c.url, c.expect); }));

let api = null;
const a = await check(config.api_status_url);
if (a.ok) {
  try { api = { ...JSON.parse(a.body), _ms: a.ms }; } catch { api = null; }
}

let prev = {};
try { prev = JSON.parse(fs.readFileSync(prevPath, 'utf8')); } catch { /* premier passage */ }

const { data, changes } = merge(prev, evaluate(config, http, api));
fs.writeFileSync(outPath, JSON.stringify(data));

for (const [id, c] of Object.entries(data.components)) console.log(`${c.status.padEnd(12)} ${id}${c.latency_ms != null ? ` (${c.latency_ms} ms)` : ''}`);

const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chat } = process.env;
if (changes.length && token && chat) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text: alertText(config, changes), parse_mode: 'HTML', disable_web_page_preview: true }),
  }).catch((e) => ({ ok: false, statusText: e.message }));
  console.log(res.ok ? 'Alerte envoyée.' : `Alerte non envoyée : ${res.status || ''} ${res.statusText || ''}`);
}
