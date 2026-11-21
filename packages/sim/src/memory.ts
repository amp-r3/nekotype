import type { Grade, Memory as Fsrs6Memory } from '@nekotype/model';

export type { Grade };

/** A memory of the sim: FSRS-6's, or FSRS-7's with the stability of its fast trace. */
export interface Memory extends Fsrs6Memory {
  /** FSRS-7 only (`src/fsrs7.ts`): the stability of the fast trace. */
  readonly fast?: number;
}
