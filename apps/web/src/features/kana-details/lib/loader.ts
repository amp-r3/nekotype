import type { ComponentType } from 'preact';
import { loadDictionaryPart } from '@/shared/i18n';
import type { KanaDetailsDialogProps } from '../ui/kana-details-dialog';

// The dialog is a chunk of its own, with its part of the dictionary: it shows only when a learner
// opens a kana, so neither is in the first load (P8 plan, D12).
let loaded: Promise<ComponentType<KanaDetailsDialogProps>> | undefined;

/** The dialog and its strings, fetched once; a failure is not kept, so a later call tries again. */
export function loadKanaDetails(): Promise<ComponentType<KanaDetailsDialogProps>> {
  if (loaded !== undefined) return loaded;
  const request = Promise.all([import('../ui/kana-details-dialog'), loadDictionaryPart('details')])
    .then(([module]) => module.KanaDetailsDialog)
    .catch((error: unknown) => {
      loaded = undefined;
      throw error;
    });
  loaded = request;
  return request;
}

/** Fetches the dialog ahead of time; a failure is ignored (the dialog loads again when opened). */
export async function prefetchKanaDetails(): Promise<void> {
  await loadKanaDetails().catch(() => undefined);
}
