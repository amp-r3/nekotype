import type { ReadonlySignal } from '@preact/signals';
import { signal } from '@preact/signals';
import type { LearnKanaKey } from '@nekotype/shared/types';
import { immersive } from '@/shared/lib';

const _open = signal<LearnKanaKey | null>(null);

/** The kana whose details are open, if any. */
export const openKanaKey: ReadonlySignal<LearnKanaKey | null> = _open;

/** Opens the details of a kana. Nothing happens during a session: it never shows one. */
export function openKanaDetails(key: LearnKanaKey): void {
  if (immersive.value) return;
  _open.value = key;
}

export function closeKanaDetails(): void {
  _open.value = null;
}
