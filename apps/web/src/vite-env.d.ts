/// <reference types="vite/client" />

// True in the test build that carries the latency probe, false in every other build.
declare const __LATENCY_PROBE__: boolean;

// The commit the build was made from (12 characters), or `dev`.
declare const __APP_VERSION__: string;
