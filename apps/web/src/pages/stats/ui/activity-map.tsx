import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { locale, t, tPlural } from '@/shared/i18n';
import { cx } from '@/shared/lib';
import { dayStart } from '@/entities/learn';
import { levelOf, gridDays } from '../lib/activity';
import type { ActivityDay } from '../lib/activity';
import { mondayOf } from '../lib/answer-time';

const NONE: ActivityDay = { answers: 0, tests: 0, active: false };
const LEVELS = [0, 1, 2, 3, 4, 5] as const;
const MONTH_GAP = 3;

type Props = {
  readonly days: ReadonlyMap<number, ActivityDay>;
  readonly today: number;
  /** Columns, already limited for the screen. */
  readonly weeks: number;
};

function swatch(classes: string, key: string | number): JSX.Element {
  return <span key={key} className={`nk-am__cell nk-am__sw ${classes}`} aria-hidden="true" />;
}

// Activity by day: the fill is the recall answers of the day, a square is a typing test, the
// border is today (design ActivityMap). One Tab stop; arrows move by a day or a week.
export function ActivityMap({ days, today, weeks }: Props): JSX.Element {
  const list = gridDays(today, weeks);
  const count = list.length;
  const [hover, setHover] = useState<number | null>(null);
  const [focus, setFocus] = useState(count - 1);
  const grid = useRef<HTMLDivElement>(null);
  const current = Math.min(focus, count - 1);

  const dateFormat = new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short' });
  const monthFormat = new Intl.DateTimeFormat(locale.value, { month: 'short' });
  const weekdayFormat = new Intl.DateTimeFormat(locale.value, { weekday: 'short' });
  const monday = mondayOf(today);

  const lines = (index: number): string[] => {
    const day = list[index] ?? today;
    const info = days.get(day) ?? NONE;
    const numbers = [
      info.answers > 0 ? tPlural('stats.answers', info.answers) : '',
      info.tests > 0 ? tPlural('stats.tests', info.tests) : '',
    ].filter((part) => part !== '');
    return [
      dateFormat.format(dayStart(day)),
      numbers.length > 0 ? numbers.join(' · ') : t('stats.activity.none'),
      ...(index === count - 1 ? [t('stats.activity.today')] : []),
    ];
  };

  const months: { col: number; name: string }[] = [];
  let lastCol = -MONTH_GAP;
  list.forEach((day, index) => {
    const date = new Date(dayStart(day));
    const col = Math.floor(index / 7);
    if (date.getDate() === 1 && col - lastCol >= MONTH_GAP && col < weeks - 1) {
      months.push({ col, name: monthFormat.format(date) });
      lastCol = col;
    }
  });

  const onKeyDown = (event: KeyboardEvent, index: number): void => {
    const target =
      event.key === 'ArrowRight'
        ? index + 7
        : event.key === 'ArrowLeft'
          ? index - 7
          : event.key === 'ArrowDown'
            ? index + 1
            : event.key === 'ArrowUp'
              ? index - 1
              : event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? count - 1
                  : null;
    if (target === null) return;
    event.preventDefault();
    const next = Math.max(0, Math.min(count - 1, target));
    setFocus(next);
    const cell = grid.current?.children[next];
    if (cell instanceof HTMLElement) cell.focus();
  };

  const shown = hover;
  const tipCol = shown === null ? 0 : Math.floor(shown / 7);

  return (
    <figure className="nk-am" style={{ '--nk-am-weeks': weeks }} data-testid="activity-map">
      <div className="nk-am__months text-mono-small font-mono" aria-hidden="true">
        {months.map((month) => (
          <span key={month.col} style={{ gridColumn: month.col + 1 }}>
            {month.name}
          </span>
        ))}
      </div>
      <div className="nk-am__wd text-mono-small font-mono" aria-hidden="true">
        {[0, 2, 4].map((row) => (
          <span key={row} style={{ gridRow: row + 1 }}>
            {weekdayFormat.format(dayStart(monday + row))}
          </span>
        ))}
      </div>
      <div
        className="nk-am__grid"
        ref={grid}
        role="group"
        aria-label={t('stats.activity.label')}
        onMouseLeave={() => {
          setHover(null);
        }}
      >
        {list.map((day, index) => {
          const info = days.get(day) ?? NONE;
          const classes = [
            'nk-am__cell',
            `is-l${levelOf(info.answers, info.active)}`,
            info.tests > 0 ? 'is-test' : '',
            index === count - 1 ? 'is-today' : '',
          ].join(' ');
          return (
            <button
              key={day}
              type="button"
              className={classes}
              tabIndex={index === current ? 0 : -1}
              aria-label={lines(index).join(', ')}
              data-testid="activity-cell"
              onMouseEnter={() => {
                setHover(index);
              }}
              onFocus={() => {
                setHover(index);
                setFocus(index);
              }}
              onBlur={() => {
                setHover(null);
              }}
              onKeyDown={(event) => {
                onKeyDown(event, index);
              }}
            />
          );
        })}
        {shown !== null && (
          <div
            className={cx(
              'nk-am__tip text-ui-caption',
              tipCol < 4 && 'is-start',
              tipCol > weeks - 5 && 'is-end',
            )}
            role="tooltip"
            style={{ '--c': tipCol, '--r': shown % 7 }}
            data-testid="activity-tip"
          >
            {lines(shown).map((line, index) => (
              <span key={index}>{line}</span>
            ))}
          </div>
        )}
      </div>
      <div className="nk-am__legend text-ui-caption">
        <span className="nk-am__legend-item">
          {t('stats.activity.fewer')}
          {LEVELS.map((level) => swatch(`is-l${level}`, level))}
          {t('stats.activity.more')}
        </span>
        <span className="nk-am__legend-item">
          {swatch('is-l2 is-test', 'test')}
          {t('stats.activity.test')}
        </span>
        <span className="nk-am__legend-item">
          {swatch('is-l0 is-today', 'today')}
          {t('stats.activity.today')}
        </span>
      </div>
    </figure>
  );
}
