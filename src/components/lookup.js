// Resolve a squad id to a display player. Players who have dropped out of the market
// (released, retired) fall back to the snapshot kept on the team, at their purchase price.
export function playerFor(id, team, playersById) {
  if (!id) return null;
  const live = playersById.get(id);
  if (live) return live;
  const info = team.info[id];
  return info ? { id, ...info, price: team.buy[id] ?? null, value: 0, weekProj: null, opponent: null, injury: null } : null;
}

export const shortName = (p) => (p.pos === 'DEF' ? p.team : `${p.name.split(' ')[0][0]}. ${p.name.split(' ').slice(1).join(' ')}`);

const INJURY_SHORT = { Questionable: 'Q', Doubtful: 'D', Out: 'O', IR: 'IR', PUP: 'PUP', Sus: 'SUS', NA: 'NA' };
export const injuryShort = (inj) => (inj ? INJURY_SHORT[inj.status] ?? inj.status : null);
