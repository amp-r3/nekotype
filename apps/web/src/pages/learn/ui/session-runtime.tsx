import { learnStrictness, learnTargetMs, learnTrack } from '@/entities/settings';
import {
  countSession,
  introduce,
  learnState,
  recordRecall,
  recordRecognition,
} from '@/entities/learn';
import { defaultClock, defaultRng, defaultScheduler } from '@/shared/lib';
import { createLearnSession } from '../model/session';
import type { LearnSession } from '../model/session';
import { silentAudio } from '../lib/audio';
import { reviewQueue } from '../lib/review-queue';

export { SessionScreen } from './session-screen';
// The end of a session is reached only through a session, so its screen travels with this chunk.
export { SummaryScreen } from './summary-screen';

/** Opens a learning or review session of the selected track on the current learning state. */
export function openSession(mode: 'learning' | 'review'): LearnSession {
  const track = learnTrack.value;
  return createLearnSession({
    track,
    mode,
    queue:
      mode === 'review'
        ? reviewQueue(learnState.value, track, learnTargetMs.value, defaultClock.now())
        : [],
    store: { state: learnState, introduce, recordRecall, recordRecognition, countSession },
    clock: defaultClock,
    scheduler: defaultScheduler,
    rng: defaultRng,
    audio: silentAudio,
    strictness: () => learnStrictness.value,
    targetMs: () => learnTargetMs.value,
  });
}
