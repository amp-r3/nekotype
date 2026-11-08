import type { ReadonlySignal } from '@preact/signals';
import { signal } from '@preact/signals';
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
  const request = import('./ui/summary-panel')
    .then((module) => {
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
