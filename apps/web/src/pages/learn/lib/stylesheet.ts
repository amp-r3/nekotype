const loading = new Map<string, Promise<void>>();

/**
 * Adds a stylesheet to the document, once per address, and resolves when it applies. A failed one is
 * removed and forgotten, so a later call asks for it again. Vite's own loading of a chunk's
 * stylesheet does not: after a failure it imports the chunk without its styles.
 */
export function loadStylesheet(href: string): Promise<void> {
  const known = loading.get(href);
  if (known !== undefined) return known;
  const request = new Promise<void>((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.addEventListener('load', () => {
      resolve();
    });
    link.addEventListener('error', () => {
      link.remove();
      loading.delete(href);
      reject(new Error(`The stylesheet ${href} failed to load`));
    });
    document.head.append(link);
  });
  loading.set(href, request);
  return request;
}
