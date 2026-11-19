import { useEffect, useState } from 'preact/hooks';

/** Whether the keyboard has Cmd rather than Ctrl as its command key: Mac, iPhone and iPad. */
export function isApplePlatform(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
}

/** `navigator.onLine`, kept current. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = (): void => {
      setOnline(navigator.onLine);
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}
