import type { ReadonlySignal } from '@preact/signals';
import { signal } from '@preact/signals';
import type { Strictness } from '@nekotype/engine';
import type { LearnTrack } from './types';
import type { ValidSettings } from '@/shared/lib';
import type { ChangeChannel, Clock, Db } from '@/shared/lib';
import { changeChannel, defaultClock, isSettings, reportWriteFailure } from '@/shared/lib';

const SETTINGS_STORE = 'settings';
const SETTINGS_KEY = 'current';

const _learnStrictness = signal<Strictness>('learner');
const _learnTrack = signal<LearnTrack>('hiragana');
// Played after each task from P10; stored so that the document round-trips.
const _learnSound = signal<boolean>(true);
const _updatedAt = signal<number>(0);
const _settingsReady = signal<boolean>(false);

export const learnStrictness: ReadonlySignal<Strictness> = _learnStrictness;
export const learnTrack: ReadonlySignal<LearnTrack> = _learnTrack;
/** True once the settings have been read from the database (or defaults were taken). */
export const settingsReady: ReadonlySignal<boolean> = _settingsReady;

let boundDb: Db | null = null;
let boundClock: Clock = defaultClock;
let boundChannel: ChangeChannel = { post() {}, listen() {} };
let listeningTo: ChangeChannel | null = null;

function snapshot(): ValidSettings {
  return {
    learn: {
      strictness: _learnStrictness.value,
      track: _learnTrack.value,
      sound: _learnSound.value,
    },
    updatedAt: _updatedAt.value,
  };
}

function applyDefaults(): void {
  _learnStrictness.value = 'learner';
  _learnTrack.value = 'hiragana';
  _learnSound.value = true;
  _updatedAt.value = 0;
}

/**
 * Each change is written at once, never inside a keystroke handler: settings change on clicks. A
 * transaction started in `pagehide` may not commit before the page unloads, so nothing waits for it.
 */
function persist(): void {
  _updatedAt.value = boundClock.now();
  const db = boundDb;
  if (!db) return;
  db.put(SETTINGS_STORE, SETTINGS_KEY, snapshot())
    .then(() => {
      boundChannel.post();
    })
    .catch(() => {
      // The write failed (quota, a closed connection): the setting holds for this page load.
      reportWriteFailure();
    });
}

function apply(saved: ValidSettings): void {
  _learnStrictness.value = saved.learn.strictness;
  _learnTrack.value = saved.learn.track;
  _learnSound.value = saved.learn.sound;
  _updatedAt.value = saved.updatedAt;
}

// Another tab wrote the document: take it. Sign-out deletes it: the defaults return (Q3).
async function reread(): Promise<void> {
  try {
    if (boundDb === null) return;
    const saved = await boundDb.get(SETTINGS_STORE, SETTINGS_KEY);
    if (isSettings(saved)) apply(saved);
    else if (saved === undefined) applyDefaults();
  } catch {
    // Unreadable: this tab's settings stand.
  }
}

/**
 * Reads the settings from the `settings` store; a value that fails validation is replaced by the
 * defaults (ADR 061). Resolves once `settingsReady` is true. Never rejects.
 */
export async function initSettings(
  db: Promise<Db>,
  clock: Clock = defaultClock,
  channel: ChangeChannel = changeChannel('nekotype:settings'),
): Promise<void> {
  boundClock = clock;
  boundChannel = channel;
  if (listeningTo !== channel) {
    listeningTo = channel;
    channel.listen(() => {
      void reread();
    });
  }
  applyDefaults();
  try {
    const opened = await db;
    boundDb = opened;
    const saved = await opened.get(SETTINGS_STORE, SETTINGS_KEY);
    if (isSettings(saved)) apply(saved);
  } catch {
    // Unreadable: the defaults stand.
  }
  _settingsReady.value = true;
}

export function setLearnStrictness(strictness: Strictness): void {
  _learnStrictness.value = strictness;
  persist();
}

export function setTrack(track: LearnTrack): void {
  _learnTrack.value = track;
  persist();
}
