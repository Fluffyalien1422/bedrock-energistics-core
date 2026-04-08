/**
 * Base type for IPC callbacks.
 * @beta
 * @template TArg The argument type passed to the callback.
 * @template TReturn The return type of the callback.
 */
export type BaseIpcCallback<TArg, TReturn> = (
  this: null,
  arg: TArg,
) => TReturn | Promise<TReturn>;
