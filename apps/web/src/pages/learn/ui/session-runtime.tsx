import { learnStrictness, learnTrack } from '@/entities/settings';
import {
  endSession,
  introduce,
  learnView,
  modelState,
  recordAnswer,
  startSession,
} from '@/entities/learn';
import { defaultClock, defaultRng, defaultScheduler } from '@/shared/lib';
import { createLearnSession } from '../model/session';
import type { LearnSession } from '../model/session';
import { silentAudio } from '../lib/audio';

export { SessionScreen } from './session-screen';
// The end of a session is reached only through a session, so its screen travels with this chunk.
export { SummaryScreen } from './summary-screen';

/** Opens a learning session on the planner of the model (P7 plan, D18). */
export function openSession(): LearnSession {
  return createLearnSession({
    track: learnTrack.value,
    store: { view: learnView, modelState, startSession, endSession, introduce, recordAnswer },
    clock: defaultClock,
    scheduler: defaultScheduler,
    rng: defaultRng,
    audio: silentAudio,
    strictness: () => learnStrictness.value,
  });
}
