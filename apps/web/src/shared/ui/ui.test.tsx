// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { Button } from './button';
import { Switch } from './switch';
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
