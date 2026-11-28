import { learnStrictness, learnTrack } from '@/entities/settings';
import {
  endSession,
  insights,
  introduce,
  learnVersion,
  learnView,
  modelState,
  reasonAt,
  recordAnswer,
  requestInsights,
  startSession,
} from '@/entities/learn';
import { defaultClock, defaultRng, defaultScheduler } from '@/shared/lib';
import { createLearnSession } from '../model/session';
import { createSummaryModel } from '../model/summary';
import type { SummaryModel } from '../model/summary';
import type { LearnSession } from '../model/session';
import { forecastBeforeOf } from '../lib/summary';
import { silentAudio } from '../lib/audio';
import { loadStylesheet } from '../lib/stylesheet';
import sessionStyles from './session.css?url';

export { SessionScreen } from './session-screen';
// The end of a session is reached only through a session, so its screen travels with this chunk.
export { SummaryScreen } from './summary-screen';

/** The styles of the session's tasks; the loader waits for them before the session is shown. */
export function loadSessionStyles(): Promise<void> {
  return loadStylesheet(sessionStyles);
}

/** Opens a learning session on the planner of the model (P7 plan, D18). */
export function openSession(): LearnSession {
  const track = learnTrack.value;
  return createLearnSession({
    track,
    forecastBefore: () => forecastBeforeOf(insights.value, learnVersion.value, track),
    store: { view: learnView, modelState, startSession, endSession, introduce, recordAnswer },
    clock: defaultClock,
    scheduler: defaultScheduler,
    rng: defaultRng,
    audio: silentAudio,
    strictness: () => learnStrictness.value,
  });
}

/** The page model of the summary of `session`: the forecast change and whether to continue. */
export function openSummaryModel(session: LearnSession): SummaryModel {
  return createSummaryModel({
    track: session.track,
    before: session.forecastBefore,
    version: learnVersion,
    insights,
    requestInsights,
    reasonAt,
    clock: defaultClock,
  });
}
