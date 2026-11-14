// Logique de la page de statut, sans effet de bord : testée à part (test/lib.test.mjs).

export const RANK = { operational: 0, degraded: 1, down: 2 };
export const HISTORY_DAYS = 90;
export const SLOW_MS = 5000;

/** Le pire de plusieurs états. Un état inconnu compte comme dégradé : on ne sait pas, on ne promet rien. */
export function worst(states) {
  let out = 'operational';
  for (const s of states) {
    const v = s === 'unknown' || s == null ? 'degraded' : s;
    if ((RANK[v] ?? 1) > RANK[out]) out = v;
  }
  return out;
}

/**
 * État de chaque composant à partir des mesures du passage.
 * http : { [id]: { ok, status, ms } } — résultat de l'appel direct à l'adresse du composant.
 * api : réponse de /api/v1/status, ou null si l'API n'a pas répondu.
 * Sans l'API, tout ce qui en dépend est en panne : c'est elle qui fait tourner le reste.
 */
export function evaluate(config, http, api) {
  const out = {};
  for (const c of config.components) {
    const states = [];
    let ms = null;
    if (c.url) {
      const h = http[c.id];
      ms = h?.ms ?? null;
      states.push(!h || !h.ok ? 'down' : h.ms > SLOW_MS ? 'degraded' : 'operational');
    }
    for (const key of c.from_api || []) {
      states.push(api ? api.components?.[key]?.status ?? 'unknown' : 'down');
    }
    if (!c.url && c.from_api?.includes('api') && api && ms === null) ms = api._ms ?? null;
    out[c.id] = { status: worst(states), latency_ms: ms };
  }
  return out;
}

/** Fusionne le passage avec les données précédentes : état courant, depuis quand, historique par jour, changements. */
export function merge(prev, current, now = new Date()) {
  const iso = now.toISOString();
  const day = iso.slice(0, 10);
  const data = {
    updated_at: iso,
    overall: worst(Object.values(current).map((c) => c.status)),
    components: {},
    days: {},
    events: Array.isArray(prev?.events) ? [...prev.events] : [],
  };
  const changes = [];
  const cutoff = new Date(now.getTime() - HISTORY_DAYS * 864e5).toISOString().slice(0, 10);

  for (const [id, c] of Object.entries(current)) {
    const before = prev?.components?.[id];
    const changed = !before || before.status !== c.status;
    data.components[id] = {
      status: c.status,
      latency_ms: c.latency_ms,
      since: changed ? iso : before.since || iso,
      checked_at: iso,
    };
    if (before && changed) {
      const ev = { component: id, from: before.status, to: c.status, at: iso, after_minutes: Math.round((now - new Date(before.since || iso)) / 6e4) };
      data.events.unshift(ev);
      changes.push(ev);
    }

    // Historique : par jour, nombre de vérifications [opérationnel, dégradé, en panne]
    const days = { ...(prev?.days?.[id] || {}) };
    const counts = days[day] ? [...days[day]] : [0, 0, 0];
    counts[RANK[c.status]]++;
    days[day] = counts;
    for (const d of Object.keys(days)) if (d < cutoff) delete days[d];
    data.days[id] = days;
  }

  data.events = data.events.slice(0, 100);
  return { data, changes };
}

/** Disponibilité sur la période : part des vérifications où le service répondait (dégradé compris). */
export function uptime(days) {
  let ok = 0, total = 0;
  for (const [o, d, x] of Object.values(days || {})) { ok += o + d; total += o + d + x; }
  return total ? (ok / total) * 100 : null;
}

const LABEL = { operational: 'rétabli', degraded: 'dégradé', down: 'en panne' };
const ICON = { operational: '🟢', degraded: '🟠', down: '🔴' };

/** Message Telegram pour l'équipe quand des composants changent d'état. */
export function alertText(config, changes) {
  const lines = changes.map((ev) => {
    const c = config.components.find((x) => x.id === ev.component);
    const name = c?.name?.fr || ev.component;
    const extra = ev.to === 'operational' && ev.after_minutes > 0 ? ` (après ${ev.after_minutes} min)` : '';
    return `${ICON[ev.to]} <b>${name}</b> : ${LABEL[ev.to]}${extra}`;
  });
  return `📡 <b>${config.name} — status.easyyad.com</b>\n\n${lines.join('\n')}`;
}
