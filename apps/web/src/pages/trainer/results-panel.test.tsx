// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'preact';
import { ResultsPanel } from './ui/results-panel';
import { createSession } from '@/features/training';
import type { Session } from '@/features/training';
import type { Clock } from '@/shared/lib';
import { loadDictionaryPart } from '@/shared/i18n';

// The route brings the strings of the screen; here the test does.
await loadDictionaryPart('type');

// Spec "Keyboard": Enter on the results screen is "Next test". The button must have the focus the
// moment the screen is on display; a key pressed right after it appears must not be lost.
describe('results panel: Enter starts the next test', () => {
  let container: HTMLDivElement;

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  function finishedSession(): Session {
    let time = 1000;
    const clock: Clock = { now: () => time };
    const session = createSession({
      nextPrompt: () => ({ key: 'basic:a', text: 'あ' }),
      config: () => ({ kind: 'zen' }),
      clock,
    });
    session.loadPrompt({ key: 'basic:a', text: 'あ' }, 'learner');
    for (let i = 0; i < 3; i++) {
      time += 200;
      session.handleIntent({ kind: 'char', char: 'a' });
    }
    time += 200;
    session.finish();
    return session;
  }

  it('has the focus on Next test as soon as it is rendered, with no wait for an effect', () => {
    const session = finishedSession();
    expect(session.metrics.value).not.toBeNull();
    container = document.createElement('div');
    document.body.appendChild(container);

    let started = 0;
    render(
      <ResultsPanel
        session={session}
        onNextTest={() => {
          started += 1;
        }}
      />,
      container,
    );

    // Synchronously after render: a passive effect would not have run yet.
    const next = container.querySelector('button');
    expect(next?.textContent).toBe('Next Test');
    expect(document.activeElement).toBe(next);

    next?.click();
    expect(started).toBe(1);
  });
});
