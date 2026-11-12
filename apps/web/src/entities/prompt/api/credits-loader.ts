/** The credit of one phrase: the Tatoeba authors of its sentence, translation and transcription. */
export type PhraseCredit = {
  readonly id: string;
  readonly text: string;
  readonly sentence: { readonly id: number; readonly author: string };
  readonly translation: { readonly id: number; readonly author: string };
  // `null`: machine-generated and checked against kuromoji.
  readonly transcriptionAuthor: string | null;
};

function isAuthored(value: unknown): value is { readonly id: number; readonly author: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'number' &&
    'author' in value &&
    typeof value.author === 'string'
  );
}

function isPhraseCredit(value: unknown): value is PhraseCredit {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'text' in value &&
    typeof value.text === 'string' &&
    'sentence' in value &&
    isAuthored(value.sentence) &&
    'translation' in value &&
    isAuthored(value.translation) &&
    'transcriptionAuthor' in value &&
    (value.transcriptionAuthor === null || typeof value.transcriptionAuthor === 'string')
  );
}

// One request at a time and one success kept; a failure is forgotten so a retry fetches again.
let pending: Promise<readonly PhraseCredit[]> | undefined;

/** Loads `credits.json`, a content chunk of its own (content.md "Attribution and reporting"). */
export function loadCredits(): Promise<readonly PhraseCredit[]> {
  if (pending !== undefined) return pending;
  const request = import('../content/credits.json').then(({ default: data }) => {
    if (!Array.isArray(data) || !data.every(isPhraseCredit)) {
      throw new Error('Phrase credits are malformed');
    }
    return data;
  });
  pending = request;
  request.catch(() => {
    if (pending === request) pending = undefined;
  });
  return request;
}
