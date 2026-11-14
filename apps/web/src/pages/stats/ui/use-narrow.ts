import { useEffect, useState } from 'preact/hooks';

const NARROW = '(max-width: 639px)';

/** True below 640 px. */
export function useNarrow(): boolean {
  const query = (): boolean => typeof matchMedia === 'function' && matchMedia(NARROW).matches;
  const [narrow, setNarrow] = useState(query);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return undefined;
    const list = matchMedia(NARROW);
    const update = (): void => {
      setNarrow(list.matches);
    };
    list.addEventListener('change', update);
    return () => {
      list.removeEventListener('change', update);
    };
  }, []);
  return narrow;
}
