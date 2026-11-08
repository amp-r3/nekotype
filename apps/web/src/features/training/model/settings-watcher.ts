import { effect, untracked } from '@preact/signals';
import {
  scriptSetting,
  contentSetting,
  strictnessSetting,
  weakFocusSetting,
  testConfig,
} from '@/entities/settings';

// Reading a signal's value inside an effect is what subscribes to it.
function readAll(...values: readonly unknown[]): number {
  return values.length;
}

/**
 * Calls `onReset` whenever one of the five practice and test settings changes, but not for the
 * values present when it is set up. The settings slice cannot reset a session itself, so this is
 * where a change of setting ends the running test.
 */
export function setupSettingsResetWatcher(onReset: () => void): () => void {
  let isFirstRun = true;

  const dispose = effect(() => {
    // Subscribe to all five practice and test settings.
    readAll(
      scriptSetting.value,
      contentSetting.value,
      strictnessSetting.value,
      weakFocusSetting.value,
      testConfig.value,
    );

    if (isFirstRun) {
      isFirstRun = false;
      return;
    }

    untracked(onReset);
  });

  return dispose;
}
