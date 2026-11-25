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
import type { ShownForecast } from '@/entities/learn';
import { defaultClock, defaultRng, defaultScheduler } from '@/shared/lib';
import { createLearnSession } from '../model/session';
import { createSummaryModel } from '../model/summary';
import type { SummaryModel } from '../model/summary';
import type { LearnSession } from '../model/session';
import type { Track } from '@nekotype/shared/types';
import { silentAudio } from '../lib/audio';

export { SessionScreen } from './session-screen';
// The end of a session is reached only through a session, so its screen travels with this chunk.
export { SummaryScreen } from './summary-screen';

/** The forecast the home shows for the track now; null unless it is ready and up to date (D9). */
function shownForecast(track: Track): ShownForecast | null {
  const current = insights.value;
  if (current === null || current.track !== track || current.version !== learnVersion.value) {
    return null;
  }
  return current.forecast.kind === 'ready' ? current.forecast.forecast : null;
}

/** Opens a learning session on the planner of the model (P7 plan, D18). */
export function openSession(): LearnSession {
  const track = learnTrack.value;
  return createLearnSession({
    track,
    forecastBefore: () => shownForecast(track),
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
