import type { AudioProvider } from '@nekotype/shared/types';

/** Until P10 the session plays nothing (docs/spec/learning.md, "Audio"). */
export const silentAudio: AudioProvider = {
  play() {
    // No sound yet.
  },
};
