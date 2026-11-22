import type { Item } from './items';
import type { Rng } from './rng';

/**
 * The 4 options of a recognition task, the answer among them: the first introduced kana that
 * looks like it, then random introduced kana of its track, then any kana to fill up. Both A4
 * planners build their options with this rule, so they differ in nothing else (P7 plan, D10).
 */
export function recognitionOptions(
  items: readonly Item[],
  id: number,
  introduced: (id: number) => boolean,
  rng: Rng,
): number[] {
  const track = items[id]?.track;
  const chosen = new Set([id]);
  const similar = items[id]?.similar.find(introduced);
  if (similar !== undefined) chosen.add(similar);
  const pool = items.flatMap((other) =>
    introduced(other.id) && !chosen.has(other.id) && other.track === track ? [other.id] : [],
  );
  while (chosen.size < 4 && pool.length > 0) {
    const [pick] = pool.splice(Math.floor(rng.next() * pool.length), 1);
    if (pick !== undefined) chosen.add(pick);
  }
  for (let other = 0; chosen.size < 4 && other < items.length; other += 1) chosen.add(other);
  return [...chosen];
}
