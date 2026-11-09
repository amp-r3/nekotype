import { describe, it, expect } from 'vitest';

// Preact core writes JSX attribute names as they are (only `preact/compat` turns `strokeWidth` into
// `stroke-width`), and the browser ignores an SVG attribute it does not know: a dashed line draws
// solid and `text-anchor` is lost. SVG attributes are written in kebab-case.
const CAMEL = [
  'strokeWidth',
  'strokeDasharray',
  'strokeDashoffset',
  'strokeOpacity',
  'strokeLinecap',
  'strokeLinejoin',
  'strokeMiterlimit',
  'fillOpacity',
  'fillRule',
  'clipPath',
  'clipRule',
  'textAnchor',
  'fontSize',
  'fontFamily',
  'fontWeight',
  'dominantBaseline',
  'shapeRendering',
  'stopColor',
  'stopOpacity',
  'vectorEffect',
];
const ATTRIBUTE = new RegExp(`\\b(${CAMEL.join('|')})=`);

const sources = import.meta.glob<string>('../**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('SVG attributes', () => {
  it('finds the source files', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(20);
  });

  it('are kebab-case in every component', () => {
    const found = Object.entries(sources)
      .filter(([file]) => !file.endsWith('.test.tsx'))
      .flatMap(([file, source]) =>
        source.split('\n').flatMap((line, at) => {
          const match = ATTRIBUTE.exec(line);
          return match === null ? [] : [`${file}:${String(at + 1)} ${match[1] ?? ''}`];
        }),
      );
    expect(found).toEqual([]);
  });

  it('would catch a camelCase attribute', () => {
    expect(ATTRIBUTE.test('<line strokeDasharray="4 4" />')).toBe(true);
    expect(ATTRIBUTE.test('<line stroke-dasharray="4 4" />')).toBe(false);
    // A style object and the real camelCase attributes are fine.
    expect(ATTRIBUTE.test("style={{ strokeWidth: '2' }}")).toBe(false);
    expect(ATTRIBUTE.test('<svg viewBox="0 0 1 1"><polyline pathLength="1" /></svg>')).toBe(false);
  });
});
