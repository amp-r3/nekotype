// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadStylesheet } from './stylesheet';

// happy-dom would load the file itself: the links stay out of the document and the test answers.
const added: HTMLLinkElement[] = [];
const append = vi.spyOn(document.head, 'append').mockImplementation((...nodes) => {
  for (const node of nodes) if (node instanceof HTMLLinkElement) added.push(node);
});

afterEach(() => {
  added.length = 0;
  append.mockClear();
});

function answer(event: 'load' | 'error'): void {
  added.at(-1)?.dispatchEvent(new Event(event));
}

describe('loadStylesheet', () => {
  it('adds one link per address and resolves when it has loaded', async () => {
    const first = loadStylesheet('/a.css');
    const second = loadStylesheet('/a.css');
    expect(added.map((link) => [link.rel, link.getAttribute('href')])).toEqual([
      ['stylesheet', '/a.css'],
    ]);

    answer('load');
    await expect(Promise.all([first, second])).resolves.toBeDefined();
  });

  it('removes a link that failed, and the next call asks again', async () => {
    const failed = loadStylesheet('/b.css');
    const link = added[0];
    if (link === undefined) throw new Error('no link');
    const remove = vi.spyOn(link, 'remove');
    answer('error');
    await expect(failed).rejects.toThrow('/b.css');
    expect(remove).toHaveBeenCalled();

    const again = loadStylesheet('/b.css');
    expect(added).toHaveLength(2);
    answer('load');
    await expect(again).resolves.toBeUndefined();
  });
});
