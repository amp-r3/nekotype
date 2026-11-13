// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createRef, render } from 'preact';
import { act } from 'preact/test-utils';
import { Button } from './button';
import { Switch } from './switch';
import { Segmented } from './segmented';
import { Toggle } from './toggle';
import { Dialog } from './dialog';
import { Kbd } from './kbd';
import { Nav } from './nav';

let container: HTMLDivElement;

function mount(node: Parameters<typeof render>[0]): HTMLDivElement {
  container = document.createElement('div');
  document.body.append(container);
  render(node, container);
  return container;
}

afterEach(() => {
  render(null, container);
  container.remove();
});

describe('Switch', () => {
  it('names the switch by its label and describes it by the description', () => {
    mount(<Switch checked label="Show" description="Under the text" onChange={() => {}} />);
    const control = container.querySelector('[role="switch"]');
    expect(control?.getAttribute('aria-checked')).toBe('true');
    const labelId = control?.getAttribute('aria-labelledby') ?? '';
    const descriptionId = control?.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(labelId)?.textContent).toBe('Show');
    expect(document.getElementById(descriptionId)?.textContent).toBe('Under the text');
  });

  it('reports the opposite value on click and does nothing when disabled', () => {
    const onChange = vi.fn();
    mount(<Switch checked={false} label="Show" onChange={onChange} />);
    container.querySelector<HTMLButtonElement>('[role="switch"]')?.click();
    expect(onChange).toHaveBeenCalledWith(true);

    const disabled = vi.fn();
    render(null, container);
    render(<Switch checked label="Show" disabled onChange={disabled} />, container);
    container.querySelector<HTMLButtonElement>('[role="switch"]')?.click();
    expect(disabled).not.toHaveBeenCalled();
  });
});

describe('Button', () => {
  it('has a text variant', () => {
    mount(<Button variant="text">Cancel</Button>);
    expect(container.querySelector('button')?.className).toContain('bg-transparent');
  });
});

describe('Nav', () => {
  it('has no line under the bar', () => {
    mount(
      <Nav
        brand="logo"
        brandHref="/"
        items={[{ href: '/', label: 'learn' }]}
        currentPath="/"
        onNavigate={() => {}}
        ariaLabel="Main"
      />,
    );
    expect(container.querySelector('header')?.className).not.toContain('border-b');
  });
});

describe('Button', () => {
  it('draws the hint as a bare key', () => {
    mount(
      <Button variant="primary" hint="enter">
        next test
      </Button>,
    );
    const key = container.querySelector('kbd');
    expect(key?.textContent).toBe('enter');
    expect(key?.className).not.toContain('border');
  });
});

describe('Kbd', () => {
  it('has a border unless it is bare', () => {
    mount(<Kbd>tab</Kbd>);
    expect(container.querySelector('kbd')?.className).toContain('border');
  });
});

describe('Segmented', () => {
  const options = [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B' },
    { value: 'c', label: 'C' },
  ] as const;

  function press(el: Element | null, key: string): void {
    el?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  }

  it('is one Tab stop: only the selected option is tabbable', () => {
    mount(<Segmented options={options} value="b" onChange={() => {}} ariaLabel="group" />);
    const tabIndexes = [...container.querySelectorAll('[role="radio"]')].map((el) =>
      el.getAttribute('tabindex'),
    );
    expect(tabIndexes).toEqual(['-1', '0', '-1']);
  });

  it('moves the choice and the focus with the arrows, wrapping at the ends', () => {
    const onChange = vi.fn();
    mount(<Segmented options={options} value="a" onChange={onChange} ariaLabel="group" />);
    const items = container.querySelectorAll('[role="radio"]');
    press(items[0] ?? null, 'ArrowLeft');
    expect(onChange).toHaveBeenLastCalledWith('c');
    expect(document.activeElement).toBe(items[2]);
    press(items[0] ?? null, 'ArrowRight');
    expect(onChange).toHaveBeenLastCalledWith('b');
    expect(document.activeElement).toBe(items[1]);
  });
});

describe('Toggle', () => {
  it('reports the opposite value and exposes aria-pressed', () => {
    const onChange = vi.fn();
    mount(
      <Toggle pressed={false} onChange={onChange}>
        weak kana
      </Toggle>,
    );
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-pressed')).toBe('false');
    button?.click();
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('Switch label', () => {
  it('toggles when the label is clicked', () => {
    const onChange = vi.fn();
    mount(<Switch checked={false} label="Show" onChange={onChange} />);
    container.querySelector('label')?.click();
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('Dialog', () => {
  it('gives the initial focus to the safe action', async () => {
    const cancel = createRef<HTMLButtonElement>();
    await act(() => {
      mount(
        <Dialog open onClose={() => {}} title="Reset?" closeLabel="close" initialFocusRef={cancel}>
          <button type="button" ref={cancel}>
            cancel
          </button>
        </Dialog>,
      );
    });
    expect(document.activeElement).toBe(cancel.current);
  });
});
