/**
 * Error types that classify whether a failure was caused by the add-on that
 * made the call, or by Bedrock Energistics Core itself.
 *
 * These live in the public API rather than the add-on because code shared by
 * both sides (serialization, for example) needs to throw them, and because
 * add-ons need them to handle errors from the APIs they call.
 */

/**
 * Identifies what kind of mistake caused a {@link PublicError}, so it can be
 * handled programmatically instead of by matching on the message text.
 * @beta
 */
export enum PublicErrorType {
  /**
   * The error type was missing or not recognized.
   * @beta
   * @remarks
   * This is what you get when the error came from a newer version of Bedrock
   * Energistics Core that has a type this version doesn't know about, or when
   * the failure didn't originate from Bedrock Energistics Core at all. The
   * message is preserved as-is.
   */
  Unknown = "Unknown",
  /**
   * An ID was not found in a registry, e.g. asking for a machine that was
   * never registered.
   * @beta
   */
  NotRegistered = "NotRegistered",
  /**
   * A block or entity could not be found at the given location, e.g. because
   * its chunk isn't loaded or it no longer exists.
   * @beta
   */
  NotFound = "NotFound",
  /**
   * A reference has gone stale, e.g. the inventory or network link node it
   * points at is no longer valid.
   * @beta
   */
  InvalidObject = "InvalidObject",
  /**
   * An argument was rejected, e.g. a UI element ID of the wrong type or an item
   * that the target slot doesn't allow.
   * @beta
   */
  InvalidArgument = "InvalidArgument",
  /**
   * The call was made at a point where it isn't valid, e.g. registering after
   * registration has closed, or using an API before `init` was called.
   * @beta
   */
  InvalidState = "InvalidState",
  /**
   * Registering something conflicted with an existing registration.
   * @beta
   */
  RegistrationConflict = "RegistrationConflict",
}

/**
 * An error caused by the calling add-on, such as passing an unregistered ID or
 * a location with no machine at it.
 * @beta
 * @remarks
 * These describe a mistake that the add-on can fix. Use
 * {@link PublicError.type} to tell the cases apart rather than matching on the
 * message.
 *
 * Bedrock Energistics Core runs in its own pack, so many API calls cross a pack
 * boundary. When one of these is thrown on the other side of that boundary, it
 * is sent back and rethrown here, so the error surfaces in the add-on that
 * caused it rather than in the core pack's log.
 */
export class PublicError extends Error {
  constructor(
    /**
     * What kind of mistake this is.
     * @beta
     */
    readonly type: PublicErrorType,
    message: string,
  ) {
    super(message);
    this.name = "PublicError";
  }
}

/**
 * An error thrown when Bedrock Energistics Core hits a problem that isn't the
 * calling add-on's fault, such as a bug in the library itself or corrupted
 * stored data.
 * @beta
 * @remarks
 * Unlike a {@link PublicError}, there is generally nothing an add-on can do to
 * recover from one of these, and encountering one is worth reporting.
 *
 * These are never sent across the pack boundary, because the calling add-on
 * can't act on them. One thrown inside Bedrock Energistics Core is logged by
 * the core pack, and the call that triggered it resolves to `null` instead.
 */
export class InternalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InternalError";
  }
}
