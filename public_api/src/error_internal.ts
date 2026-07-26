/**
 * Encoding of {@link PublicError}s for travel between packs.
 *
 * This lives apart from `error.ts` because it is plumbing: keeping it out of
 * that module (and out of the class itself) means it never shows up on a
 * `PublicError` instance that an add-on is holding.
 */

import { PublicError, PublicErrorType } from "./error.js";

/**
 * Separates the error type from the message on the wire. The type never
 * contains this character, so the first occurrence is always the separator.
 */
const IPC_MESSAGE_SEPARATOR = "+";

const PUBLIC_ERROR_TYPES = new Set<string>(Object.values(PublicErrorType));

function isPublicErrorType(value: string): value is PublicErrorType {
  return PUBLIC_ERROR_TYPES.has(value);
}

/**
 * Encodes an error for the IPC wire as `<type>+<message>`.
 * @internal
 */
export function publicErrorToIpcMessage(error: PublicError): string {
  return error.type + IPC_MESSAGE_SEPARATOR + error.message;
}

/**
 * Decodes an error encoded by {@link publicErrorToIpcMessage}.
 * @internal
 * @remarks
 * If there is no separator, or the type before it isn't one this version knows
 * about, the result is a {@link PublicErrorType.Unknown} error carrying the
 * original string untouched. The string is not split in that case, because a
 * message that merely happens to contain a separator must not be truncated.
 */
export function publicErrorFromIpcMessage(raw: string): PublicError {
  const separatorIndex = raw.indexOf(IPC_MESSAGE_SEPARATOR);
  if (separatorIndex === -1) {
    return new PublicError(PublicErrorType.Unknown, raw);
  }

  const type = raw.slice(0, separatorIndex);
  if (!isPublicErrorType(type)) {
    return new PublicError(PublicErrorType.Unknown, raw);
  }

  return new PublicError(type, raw.slice(separatorIndex + 1));
}
