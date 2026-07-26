import { raise } from "../log";

export interface Destroyable {
  /**
   * `true` if this object is valid (has not been destroyed), otherwise `false`.
   */
  readonly isValid: boolean;

  /**
   * Destroy this object.
   * @see {@link Destroyable.isValid}
   */
  destroy(): void;
}

export abstract class DestroyableObject implements Destroyable {
  private internalIsValid = true;

  get isValid(): boolean {
    return this.internalIsValid;
  }

  /**
   * @throws if this object is not valid (if it has been destroyed)
   * @see {@link Destroyable.isValid}, {@link Destroyable.destroy}
   */
  protected ensureValidity(): void {
    if (!this.internalIsValid) {
      raise("DestroyableObject#ensureValidity: The object has been destroyed.");
    }
  }

  destroy(): void {
    this.internalIsValid = false;
  }
}
