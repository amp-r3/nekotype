export type GridKey = 'left' | 'right' | 'up' | 'down';

export type GridPos = { readonly row: number; readonly slot: number };

/**
 * The cell a key moves to in a grid of rows with gaps. `rows[r][s]` tells whether slot `s` of row
 * `r` holds a cell. ← → walk the cells in reading order across rows; ↑ ↓ go to the nearest column of
 * the adjacent row, across blocks, the lower column on a tie. The position stays when there is
 * nowhere to go.
 */
export function moveInGrid(
  rows: readonly (readonly boolean[])[],
  from: GridPos,
  key: GridKey,
): GridPos {
  if (key === 'left' || key === 'right') return step(rows, from, key === 'left' ? -1 : 1);
  const direction = key === 'up' ? -1 : 1;
  for (let row = from.row + direction; row >= 0 && row < rows.length; row += direction) {
    const slots = occupied(rows[row] ?? []);
    let best: number | undefined;
    for (const slot of slots) {
      if (best === undefined || Math.abs(slot - from.slot) < Math.abs(best - from.slot))
        best = slot;
    }
    if (best !== undefined) return { row, slot: best };
  }
  return from;
}

function occupied(slots: readonly boolean[]): number[] {
  const result: number[] = [];
  slots.forEach((present, slot) => {
    if (present) result.push(slot);
  });
  return result;
}

function step(rows: readonly (readonly boolean[])[], from: GridPos, direction: 1 | -1): GridPos {
  const own = occupied(rows[from.row] ?? []);
  const at = own.indexOf(from.slot);
  const sideways = own[at + direction];
  if (sideways !== undefined) return { row: from.row, slot: sideways };
  for (let row = from.row + direction; row >= 0 && row < rows.length; row += direction) {
    const slots = occupied(rows[row] ?? []);
    const slot = direction === 1 ? slots[0] : slots[slots.length - 1];
    if (slot !== undefined) return { row, slot };
  }
  return from;
}
