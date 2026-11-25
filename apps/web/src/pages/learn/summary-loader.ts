import type { ReadonlySignal } from '@preact/signals';
import { signal } from '@preact/signals';
import { loadDictionaryPart } from '@/shared/i18n';
import type { SummaryPanel } from './ui/summary-panel';

// The summary is a chunk of its own: it shows only when a session ends.
const _panel = signal<typeof SummaryPanel | null>(null);
const _failed = signal(false);
let inflight: Promise<boolean> | undefined;

export const summaryPanel: ReadonlySignal<typeof SummaryPanel | null> = _panel;
export const summaryLoadFailed: ReadonlySignal<boolean> = _failed;

function fetchPanel(): Promise<boolean> {
  if (_panel.value !== null) return Promise.resolve(true);
  if (inflight !== undefined) return inflight;
  // The forecast change's strings are the dictionary part `home`, which the home loads too.
  const request = Promise.all([import('./ui/summary-panel'), loadDictionaryPart('home')])
    .then(([module]) => {
      _panel.value = module.SummaryPanel;
      return true;
    })
    .catch(() => false)
    .finally(() => {
      inflight = undefined;
    });
  inflight = request;
  return request;
}

/** Loads the summary of a session that has ended. A failure is recorded; a later call retries. */
export async function loadSummaryPanel(): Promise<void> {
  if (_panel.value !== null) return;
  _failed.value = false;
  if (!(await fetchPanel())) _failed.value = true;
}

/** Fetches the summary ahead of time; a failure is not recorded. */
export async function prefetchSummaryPanel(): Promise<void> {
  await fetchPanel();
}
