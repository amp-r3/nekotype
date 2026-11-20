import type { ValidSettings } from '@/shared/lib';

// Derived from the persisted shape, so this slice does not import the prompt slice.
export type LearnTrack = ValidSettings['learn']['track'];
