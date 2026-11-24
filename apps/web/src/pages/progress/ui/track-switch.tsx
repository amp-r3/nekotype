import type { JSX } from 'preact';
import type { Track } from '@nekotype/shared/types';
import { t } from '@/shared/i18n';
import { Segmented } from '@/shared/ui';

/** The script switch: hiragana or katakana. */
export function TrackSwitch({
  value,
  onChange,
}: {
  readonly value: Track;
  readonly onChange: (track: Track) => void;
}): JSX.Element {
  return (
    <Segmented<Track>
      options={[
        { value: 'hiragana', label: t('learn.track.hiragana') },
        { value: 'katakana', label: t('learn.track.katakana') },
      ]}
      value={value}
      onChange={onChange}
      ariaLabel={t('learn.track.label')}
    />
  );
}
