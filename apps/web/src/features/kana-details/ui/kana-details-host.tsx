import type { ComponentType, JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { loadKanaDetails } from '../lib/loader';
import { closeKanaDetails, openKanaKey } from '../model/open';
import type { KanaDetailsDialogProps } from './kana-details-dialog';

/**
 * Renders the kana details once, for the whole application. It is in the first chunk and small: the
 * dialog and its strings load when a kana is first opened (and on idle, `prefetchKanaDetails`).
 * Once loaded, the dialog stays mounted and only opens and closes, so closing by `✕` or the
 * backdrop still gives the focus back to the opener.
 */
export function KanaDetailsHost(): JSX.Element | null {
  const key = openKanaKey.value;
  const [Dialog, setDialog] = useState<ComponentType<KanaDetailsDialogProps> | null>(null);

  useEffect(() => {
    if (key === null || Dialog !== null) return;
    void loadKanaDetails().then(
      (loaded) => {
        setDialog(() => loaded);
      },
      () => {
        // Nothing is drawn while it loads; a failed load closes the request, and the next click tries again.
        closeKanaDetails();
      },
    );
  }, [key, Dialog]);

  if (Dialog === null) return null;
  return <Dialog kanaKey={key} onClose={closeKanaDetails} />;
}
