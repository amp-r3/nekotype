// Key parity with `./en` is checked by `translate.test.ts`. While the part is empty a compile-time
// check does not pass lint: the change that adds the first string types this object with
// `satisfies Record<keyof typeof sessionEn, string>`, as the other parts are.
export const sessionRu = {} as const satisfies Record<string, string>;
