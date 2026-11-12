import type { KanaStat } from '@nekotype/shared/types';

/** Statistics per kana, by the kana's key in the engine's table. */
export type KanaStatMap = Readonly<Record<string, KanaStat>>;
