import { UiElementDefinition } from "./machine_registry_types.js";
import { deepFreezeCopy } from "./misc_internal.js";

/**
 * Represents the UI elements of a machine.
 * @beta
 */
export class MachineUiElements implements Iterable<
  [string, UiElementDefinition]
> {
  private readonly elements: Readonly<Record<string, UiElementDefinition>>;

  constructor(elements: Record<string, UiElementDefinition>) {
    this.elements = deepFreezeCopy(elements);
  }

  /**
   * Test if a UI element with the given ID exists.
   * @beta
   * @returns A boolean indicating whether the UI element with the specified ID exists.
   */
  has(id: string): boolean {
    return Object.hasOwn(this.elements, id);
  }

  /**
   * Gets a UI element by its ID.
   * @beta
   * @param id The ID of the UI element to get.
   * @returns The UI element with the specified ID, or `undefined` if it doesn't exist. The returned object is frozen; copy it if you need to modify it.
   */
  get(id: string): UiElementDefinition | undefined {
    if (!this.has(id)) return;
    return this.elements[id];
  }

  /**
   * Gets the IDs of all the UI elements.
   * @beta
   * @returns An array containing the IDs of all the UI elements.
   */
  ids(): string[] {
    return Object.keys(this.elements);
  }

  /**
   * Creates an iterable of the definitions of all the UI elements.
   * @beta
   * @returns An iterable of the definitions of all the UI elements.
   */
  definitions(): Iterable<UiElementDefinition> {
    return {
      [Symbol.iterator]: (): Iterator<UiElementDefinition> => {
        const ids = this.ids();
        let index = 0;
        return {
          next: (): IteratorResult<UiElementDefinition> => {
            if (index < ids.length) {
              const id = ids[index++];
              const value = this.get(id)!;
              return { value, done: false };
            }
            return { value: undefined, done: true };
          },
        };
      },
    };
  }

  /**
   * Enables iteration over the UI elements.
   * @beta
   */
  [Symbol.iterator](): Iterator<[string, UiElementDefinition]> {
    const ids = this.ids();
    let index = 0;
    return {
      next: (): IteratorResult<[string, UiElementDefinition]> => {
        if (index < ids.length) {
          const id = ids[index++];
          const value = this.get(id)!;
          return { value: [id, value], done: false };
        }
        return { value: undefined, done: true };
      },
    };
  }
}
