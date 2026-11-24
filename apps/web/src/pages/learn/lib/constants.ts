// Code constants of the learning session (learning.md, "Constants").
/** Tasks of a session; equals `SESSION_TASKS` of the model (a test checks it). */
export const SESSION_TASKS = 30;
export const ANSWER_PAUSE_MS = 400;

/** Recognition options: the right one and three distractors. */
export const OPTION_COUNT = 4;

/** The home plans its reason again this often while it is mounted (P8 plan, D2): a review that has
 *  come due turns "nothing to review" into `review`. */
export const REPLAN_MS = 60_000;
