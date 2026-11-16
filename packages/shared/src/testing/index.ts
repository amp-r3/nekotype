// Test data for the tests and the measurements of the sync (p5-plan.md, D14). Not part of the
// client: `apps/web` may import it from test files only.
export { KANA_KEYS } from './kana-keys';
export type { KanaKeys } from './kana-keys';
export { seededRng, intIn } from './rng';
export {
  BATCH_CAPS,
  DEVICE_ID,
  LAST_SEQ,
  YEAR_FIRST_DAY,
  generateBatch,
  generateYear,
} from './year';
export type { BatchKind, DeviceSeq, Year } from './year';
