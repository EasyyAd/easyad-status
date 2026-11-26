import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { alertText, evaluate, merge, uptime, worst } from '../lib.mjs';

const config = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url), 'utf8'));
const okHttp = { site: { ok: true, ms: 120 }, advertiser: { ok: true, ms: 140 }, publisher: { ok: true, ms: 140 }, app: { ok: true, ms: 140 }, partners: { ok: true, ms: 130 }, delivery: { ok: true, ms: 90 } };
const okApi = { _ms: 80, components: { api: { status: 'operational' }, database: { status: 'operational' }, scheduler: { status: 'operational' }, bot: { status: 'operational' } } };

test('le pire état l’emporte, et un état inconnu ne passe jamais pour opérationnel', () => {
  assert.equal(worst(['operational', 'operational']), 'operational');
  assert.equal(worst(['operational', 'unknown']), 'degraded');
  assert.equal(worst(['degraded', 'down', 'operational']), 'down');
});

test('tout fonctionne', () => {
  const s = evaluate(config, okHttp, okApi);
  assert.deepEqual(Object.values(s).map((c) => c.status), Array(config.components.length).fill('operational'));
  assert.equal(s.api.latency_ms, 80);
});

test('API injoignable : tout ce qui en dépend est en panne, les sites restent jugés à part', () => {
  const s = evaluate(config, okHttp, null);
  assert.equal(s.api.status, 'down');
  assert.equal(s.delivery.status, 'down');
  assert.equal(s.bot.status, 'down');
  assert.equal(s.site.status, 'operational');
});

test('tâches planifiées arrêtées : la diffusion est en panne même si le script répond', () => {
  const api = { ...okApi, components: { ...okApi.components, scheduler: { status: 'down' } } };
  assert.equal(evaluate(config, okHttp, api).delivery.status, 'down');
});

test('un site lent est dégradé, un site qui ne répond pas est en panne', () => {
  const s = evaluate(config, { ...okHttp, app: { ok: true, ms: 7000 }, site: { ok: false, ms: 10000 } }, okApi);
  assert.equal(s.app.status, 'degraded');
  assert.equal(s.site.status, 'down');
});

test('les changements d’état sont datés, comptés par jour et signalés une fois', () => {
  const t0 = new Date('2026-11-14T10:00:00Z');
  const first = merge({}, evaluate(config, okHttp, okApi), t0);
  assert.equal(first.changes.length, 0);                       // premier passage : rien à signaler
  assert.equal(first.data.overall, 'operational');

  const t1 = new Date('2026-11-14T10:05:00Z');
  const down = merge(first.data, evaluate(config, okHttp, null), t1);
  assert.deepEqual(down.changes.map((c) => c.component).sort(), ['api', 'bot', 'delivery']);
  assert.equal(down.data.overall, 'down');
  assert.equal(down.data.components.api.since, t1.toISOString());
  assert.equal(down.data.components.site.since, t0.toISOString());   // inchangé : garde sa date

  const t2 = new Date('2026-11-14T10:10:00Z');
  const still = merge(down.data, evaluate(config, okHttp, null), t2);
  assert.equal(still.changes.length, 0);                       // toujours en panne : pas de nouvelle alerte

  const t3 = new Date('2026-11-14T10:47:00Z');
  const back = merge(still.data, evaluate(config, okHttp, okApi), t3);
  const api = back.changes.find((c) => c.component === 'api');
  assert.equal(api.to, 'operational');
  assert.equal(api.after_minutes, 42);
  assert.deepEqual(back.data.days.api['2026-11-14'], [2, 0, 2]);
  assert.match(alertText(config, back.changes), /API et comptes<\/b> : rétabli \(après 42 min\)/);
});

test('l’historique ne garde que 90 jours, et la disponibilité compte le dégradé comme disponible', () => {
  const old = { components: {}, days: { site: { '2026-01-01': [5, 0, 5], '2026-11-13': [280, 4, 4] } } };
  const { data } = merge(old, evaluate(config, okHttp, okApi), new Date('2026-11-14T10:00:00Z'));
  assert.equal(data.days.site['2026-01-01'], undefined);
  assert.ok(data.days.site['2026-11-13']);
  assert.equal(uptime({ a: [96, 2, 2] }), 98);
  assert.equal(uptime({}), null);
});
