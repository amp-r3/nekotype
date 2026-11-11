import { render } from 'preact';
import { initApp } from './init';
import { App } from './App';
import { schedulePrefetch } from './prefetch';
import { contentSetting, scriptSetting, settingsReady } from '@/entities/settings';
import { effect } from '@preact/signals';
import { startRouter } from '@/shared/lib';
import './styles/index.css';

const ready = initApp();
startRouter();

const root = document.getElementById('app');
if (root) {
  // The first render waits for the language (a Russian dictionary is a chunk of its own).
  void ready.then(() => {
    render(<App />, root);
    // After the first render: fetch the other screens and the chunks while the CPU is idle.
    // The content kind and script are known only after the settings have loaded.
    let scheduled = false;
    effect(() => {
      if (!settingsReady.value || scheduled) return;
      scheduled = true;
      schedulePrefetch(() => ({ content: contentSetting.peek(), script: scriptSetting.peek() }));
    });
  });
}
