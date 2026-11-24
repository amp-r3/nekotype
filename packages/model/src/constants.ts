/**
 * The constants of the knowledge model, as simulated for candidate A4 (ADR 100). A change to one
 * is made only with a run of `pnpm --filter @nekotype/sim run p7`, its output in the pull
 * request and the maintainer's consent (rule 3b of the P7 plan).
 */

export const DAY_MS = 86_400_000;

/** Kana learning at once. */
export const LEARN_MAX = 5;
/** First learning step; doubled per correct recall. */
export const STEP_MS = 30_000;
/** Correct recalls in a row to be learned. */
export const GRADUATE = 5;
/** Requested retention (the first lever: 0.93, ADR 100). */
export const RETENTION = 0.9;
/** Requested retention at full pressure. */
export const RETENTION_MAX = 0.98;
/** Review retention that adaptation holds. */
export const GOAL = 0.9;
/** Rate of the moving average of reviews. */
export const ADAPT_RATE = 0.05;
/** Points below the goal at full pressure. */
export const PRESSURE_SPAN = 0.1;
/** Added correct recalls at full pressure. */
export const EXTRA_RECALLS_MAX = 2;
/** A gap counts when over an hour. */
export const GAP_MIN_MS = 3_600_000;
/** Gaps in the median. */
export const GAPS_KEPT = 10;
/** Expected next session until a gap is known. */
export const HORIZON_DEFAULT_MS = 43_200_000;
/** Tasks of a session at most. */
export const SESSION_TASKS = 30;
/** Recognition on a learning kana. */
export const RECOGNITION_SHARE = 0.25;
/** Introduced kana the other track may lag. */
export const TRACK_LAG = 10;
/** Learned → mastered (A52). */
export const MASTERED_STABILITY_DAYS = 21;
/** Recall answers per kana in the view. */
export const RECENT_RECALLS = 10;
/** Outcomes per kind for the forecast. */
export const OUTCOMES_KEPT = 200;
/** Fewer: the forecast uses the model. */
export const OUTCOMES_MIN = 20;
/** Sittings in the median. */
export const SITTINGS_KEPT = 10;
/** A sitting until one is known. */
export const SITTING_DEFAULT_MS = 300_000;
/** Task intervals in the median. */
export const TASK_MS_KEPT = 200;
/** A task until intervals are known. */
export const TASK_DEFAULT_MS = 4_000;
/** Answer time of a correct answer in a play. */
export const PLAY_OK_MS = 1_200;
/** Answer time of a wrong answer in a play. */
export const PLAY_WRONG_MS = 2_500;
/** Plays per forecast. */
export const FORECAST_PLAYS = 10;
/** Longest play, in sessions. */
export const FORECAST_MAX_SESSIONS = 60;
/** Longest play, in sittings. */
export const FORECAST_MAX_SITTINGS = 240;
/** Settled forecasts used for a correction. */
export const FORECAST_HISTORY = 10;
/** Settled forecasts needed for a correction. */
export const FORECAST_HISTORY_MIN = 3;
