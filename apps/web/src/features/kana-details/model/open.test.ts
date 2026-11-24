// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { setImmersive } from '@/shared/lib';
import { closeKanaDetails, openKanaDetails, openKanaKey } from './open';

afterEach(() => {
  setImmersive(false);
  closeKanaDetails();
});

describe('opening the kana details', () => {
  it('opens a kana and closes it', () => {
    expect(openKanaKey.value).toBeNull();
    openKanaDetails('hiragana:あ');
    expect(openKanaKey.value).toBe('hiragana:あ');
    closeKanaDetails();
    expect(openKanaKey.value).toBeNull();
  });

  it('does nothing while a session is on: a session never opens it', () => {
    setImmersive(true);
    openKanaDetails('hiragana:あ');
    expect(openKanaKey.value).toBeNull();
  });
});
