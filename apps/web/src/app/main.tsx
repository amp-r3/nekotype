import { render } from 'preact';
import { initApp } from './init';
import { App } from './App';
import { schedulePrefetch } from './prefetch';
import { settingsReady } from '@/entities/settings';
import { effect } from '@preact/signals';
import { startRouter } from '@/shared/lib';
import { ROUTE_REDIRECTS } from './route-paths';
import './styles/index.css';

// The test build's probe of the model's cost; dead code in the production build.
if (__LATENCY_PROBE__) {
  void import('./model-probe').then((probe) => {
    probe.installModelProbe();
  });
}

// First, so the shown path is the redirected one before anything reads it.
startRouter(ROUTE_REDIRECTS);
const ready = initApp();

const root = document.getElementById('app');
if (root) {
  // The first render waits for the language (a Russian dictionary is a chunk of its own).
  void ready.then(() => {
    render(<App />, root);
    // After the first render: fetch the other screens while the CPU is idle, once the settings
    // have loaded.
    let scheduled = false;
    effect(() => {
      if (!settingsReady.value || scheduled) return;
      scheduled = true;
      schedulePrefetch();
    });
  });
}
