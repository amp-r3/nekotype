// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createRef, render } from 'preact';
import { act } from 'preact/test-utils';
import { Button } from './button';
import { Switch } from './switch';
import { Segmented } from './segmented';
import { Select } from './select';
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

  // A transparent border colour in the same class list would win over these (Tailwind sorts the
  // utilities, not the class order).
  it.each([
    ['secondary', 'border-line-strong'],
    ['danger', 'border-miss'],
  ] as const)('draws the %s border in its own colour only', (variant, colour) => {
    mount(<Button variant={variant}>go</Button>);
    const classes = (container.querySelector('button')?.className ?? '').split(/\s+/);
    expect(classes).toContain(colour);
    expect(classes).not.toContain('border-transparent');
  });

  it('sets the interface font, not the one around it', () => {
    mount(<Button variant="text">leave</Button>);
    expect(container.querySelector('button')?.className.split(/\s+/)).toContain('font-ui');
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

describe('Segmented options with content', () => {
  it('shows the content, keeps the label as the name, and the arrows still move between options', () => {
    const onChange = vi.fn();
    mount(
      <Segmented
        tall
        options={[
          { value: 'a', label: 'basic: 3 of 46 kana open', content: <span>あ</span> },
          { value: 'b', label: 'voiced: 0 of 25 kana open', content: <span>が</span> },
        ]}
        value="a"
        onChange={onChange}
        ariaLabel="blocks"
      />,
    );
    const items = container.querySelectorAll('[role="radio"]');
    expect(items[0]?.textContent).toBe('あ');
    expect(items[0]?.getAttribute('aria-label')).toBe('basic: 3 of 46 kana open');
    expect(items[0]?.className).toContain('min-h-control-sm');
    items[0]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
    );
    expect(onChange).toHaveBeenCalledWith('b');
    expect(document.activeElement).toBe(items[1]);
  });

  it('leaves a plain option without an aria-label', () => {
    mount(<Segmented options={[{ value: 'a', label: 'A' }]} value="a" onChange={() => {}} />);
    expect(container.querySelector('[role="radio"]')?.hasAttribute('aria-label')).toBe(false);
  });
});

describe('Segmented size lg', () => {
  it('uses the heading text and a wider gap', () => {
    mount(
      <Segmented
        size="lg"
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
        value="a"
        onChange={() => {}}
        ariaLabel="group"
      />,
    );
    expect(container.querySelector('[role="radiogroup"]')?.className).toContain('gap-4');
    expect(container.querySelector('[role="radio"]')?.className).toContain('text-ui-heading');
  });
});

describe('Select', () => {
  const options = [{ value: 'a', label: 'A' }];

  it('binds a visible label to the field', () => {
    mount(<Select options={options} value="a" onChange={() => {}} label="mode" />);
    const label = container.querySelector('label');
    const select = container.querySelector('select');
    expect(label?.textContent).toBe('mode');
    expect(label?.htmlFor).toBe(select?.id);
    expect(select?.id).not.toBe('');
    expect(select?.hasAttribute('aria-label')).toBe(false);
  });

  it('names the field by aria-label when there is no visible label', () => {
    mount(<Select options={options} value="a" onChange={() => {}} ariaLabel="mode" />);
    expect(container.querySelector('label')).toBeNull();
    expect(container.querySelector('select')?.getAttribute('aria-label')).toBe('mode');
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
