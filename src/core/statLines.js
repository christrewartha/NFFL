// Box-score stats: which ones we keep, and how to show them as a short line per position.

export const BOX_KEYS = [
  'pass_cmp', 'pass_att', 'pass_yd', 'pass_td', 'pass_int',
  'rush_att', 'rush_yd', 'rush_td',
  'rec', 'rec_tgt', 'rec_yd', 'rec_td',
  'fum_lost',
  'fgm', 'fga', 'xpm', 'xpa',
  'sack', 'int', 'fum_rec', 'def_td', 'safe', 'blk_kick', 'pts_allow',
];

/** Just the box-score stats from a Sleeper stats object. */
export function boxScore(stats) {
  const out = {};
  for (const k of BOX_KEYS) if (stats?.[k] != null) out[k] = stats[k];
  return out;
}

/** Rushing, receiving and defensive TDs in a Sleeper stats object (what Paydirt doubles). */
export const scoredTds = (stats) => (stats?.rush_td ?? 0) + (stats?.rec_td ?? 0) + (stats?.def_td ?? 0);

/** Add up several weeks of box scores. */
export function sumBox(rows) {
  const total = {};
  for (const s of rows) for (const [k, v] of Object.entries(s ?? {})) total[k] = (total[k] ?? 0) + v;
  return total;
}

const n = (v) => Math.round(v ?? 0);
const plural = (v, one, many = `${one}s`) => `${n(v)} ${n(v) === 1 ? one : many}`;
const join = (...parts) => parts.filter(Boolean).join(', ');

function passing(s) {
  if (!s.pass_att) return '';
  return join(`${n(s.pass_cmp)}/${n(s.pass_att)}`, `${n(s.pass_yd)} yds`, s.pass_td && `${n(s.pass_td)} TD`, s.pass_int && `${n(s.pass_int)} INT`);
}
function rushing(s) {
  if (!s.rush_att) return '';
  return join(`${n(s.rush_att)} rush`, `${n(s.rush_yd)} yds`, s.rush_td && `${n(s.rush_td)} TD`);
}
function receiving(s) {
  if (!s.rec && !s.rec_tgt) return '';
  return join(`${n(s.rec)}/${n(s.rec_tgt)} rec`, `${n(s.rec_yd)} yds`, s.rec_td && `${n(s.rec_td)} TD`);
}

/**
 * A short box-score line, e.g. "22/31, 284 yds, 2 TD · 5 rush, 23 yds".
 * For season totals pass the games played, so a defence shows points allowed per game.
 */
export function statLine(pos, s, { games = 1 } = {}) {
  if (!s) return '';
  let parts;
  if (pos === 'K') {
    parts = [(s.fga || s.xpa) && join(`FG ${n(s.fgm)}/${n(s.fga)}`, `XP ${n(s.xpm)}/${n(s.xpa)}`)];
  } else if (pos === 'DEF') {
    const allowed = s.pts_allow != null && (games > 1 ? `${(s.pts_allow / games).toFixed(1)} pts allowed/gm` : `${n(s.pts_allow)} pts allowed`);
    parts = [join(s.sack && plural(s.sack, 'sack'), s.int && `${n(s.int)} INT`, s.fum_rec && `${n(s.fum_rec)} FR`, s.def_td && `${n(s.def_td)} TD`, s.safe && plural(s.safe, 'safety', 'safeties'), allowed)];
  } else {
    const order = pos === 'QB' ? [passing, rushing, receiving] : pos === 'RB' ? [rushing, receiving, passing] : [receiving, rushing, passing];
    parts = order.map((f) => f(s));
    if (s.fum_lost) parts.push(`${plural(s.fum_lost, 'fumble')} lost`);
  }
  return parts.filter(Boolean).join(' · ');
}
