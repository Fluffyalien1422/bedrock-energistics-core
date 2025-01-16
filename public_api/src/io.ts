import { Block, Direction } from "@minecraft/server";
import {
  RegisteredStorageType,
  StorageTypeData,
} from "./storage_type_registry.js";

const IO_TYPE_TAG_PREFIX = "fluffyalien_energisticscore:io.type.";
const IO_CATEGORY_TAG_PREFIX = "fluffyalien_energisticscore:io.category.";
const IO_ANY_TAG = "fluffyalien_energisticscore:io.any";
const IO_EXPLICIT_SIDES_TAG = "fluffyalien_energisticscore:explicit_sides";

interface MachineIoData {
  acceptsAny: boolean;
  types: string[];
  categories: string[];
}

/**
 * Represents the input/output capabilities of one side of a machine.
 * @beta
 */
export class MachineSideIo {
  private constructor(private readonly data: MachineIoData) {}

  /**
   * @beta
   * @returns Returns whether this object accepts any type or category.
   */
  get acceptsAny(): boolean {
    return this.data.acceptsAny;
  }

  /**
   * @beta
   * @returns Returns the accepted type IDs (empty if the object accepts any).
   */
  get types(): readonly string[] {
    return this.data.types;
  }

  /**
   * @beta
   * @returns Returns the accepted categories (empty if the object accepts any).
   */
  get categories(): readonly string[] {
    return this.data.categories;
  }

  /**
   * Check if this object accepts the given storage type.
   * @beta
   * @param storageType The storage type data to check.
   * @returns Whether this object accepts the given storage type.
   */
  acceptsType(storageType: StorageTypeData): boolean {
    return (
      this.acceptsAny ||
      this.categories.includes(storageType.category) ||
      this.types.includes(storageType.id)
    );
  }

  /**
   * Get a storage type by it's ID and check if this object accepts it.
   * @beta
   * @param id The ID of the storage type.
   * @returns Whether this object accepts the storage type with the given ID.
   */
  async acceptsTypeWithId(id: string): Promise<boolean> {
    if (this.acceptsAny) return true;

    const storageType = await RegisteredStorageType.get(id);
    if (!storageType) return false;

    return this.acceptsType(storageType);
  }

  /**
   * Check if this object accepts the given category.
   * @beta
   * @param category The category to check.
   * @returns Whether this object accepts the given category.
   */
  acceptsCategory(category: string): boolean {
    return this.acceptsAny || this.categories.includes(category);
  }

  /**
   * Check if this object accepts any storage type of the given category.
   * @beta
   * @param category The category to check.
   * @returns Whether this object accepts any storage type of the given category.
   */
  async acceptsAnyTypeOfCategory(category: string): Promise<boolean> {
    if (this.acceptsCategory(category)) return true;

    for (const type of this.types) {
      const storageType = await RegisteredStorageType.get(type);
      if (storageType?.category === category) return true;
    }

    return false;
  }

  /**
   * Create a new MachineSideIo object that accepts the given types and categories.
   * @beta
   * @param types Accepted type IDs.
   * @param categories Accepted categories.
   * @returns Returns a new MachineSideIo object.
   */
  static accepting(types: string[], categories: string[]): MachineSideIo {
    return new MachineSideIo({
      acceptsAny: false,
      types,
      categories,
    });
  }

  /**
   * Create a new MachineSideIo object that accepts any type or category.
   * @beta
   * @returns Returns a new MachineSideIo object.
   */
  static acceptingAny(): MachineSideIo {
    return new MachineSideIo({
      acceptsAny: true,
      types: [],
      categories: [],
    });
  }

  /**
   * Get the input/output capabilities of a machine.
   * @beta
   * @param machine The machine.
   * @param side The side of the machine to check.
   * @returns A MachineSideIo object.
   */
  static fromMachine(machine: Block, side: Direction): MachineSideIo {
    const tags = machine.getTags();

    // Check if the machine uses explicit side IO.
    if (tags.includes(IO_EXPLICIT_SIDES_TAG)) {
      return MachineSideIo.fromMachineWithExplicitSides(tags, side);
    }

    if (tags.includes(IO_ANY_TAG)) {
      return MachineSideIo.acceptingAny();
    }

    const types = tags
      .filter((tag) => tag.startsWith(IO_TYPE_TAG_PREFIX))
      .map((tag) => tag.slice(IO_TYPE_TAG_PREFIX.length));

    const categories = tags
      .filter((tag) => tag.startsWith(IO_CATEGORY_TAG_PREFIX))
      .map((tag) => tag.slice(IO_CATEGORY_TAG_PREFIX.length));

    return MachineSideIo.accepting(types, categories);
  }

  private static fromMachineWithExplicitSides(
    tags: string[],
    side: Direction,
  ): MachineSideIo {
    const strDirection = side.toLowerCase();
    const isSideDirection = side !== Direction.Up && side !== Direction.Down;

    // "fluffyalien_energisticscore:io.{type|category}.<StorageTypeId>.{north|east|south|west|up|down|side}"
    // "fluffyalien_energisticscore:io.any.{north|east|south|west|up|down|side}"

    const tagMatchesSide = (tag: string): boolean =>
      (isSideDirection && tag.endsWith(".side")) ||
      tag.endsWith(`.${strDirection}`);

    const allowsAny = tags.some((tag) => {
      if (!tag.startsWith(`${IO_ANY_TAG}.`)) return false;
      return tagMatchesSide(tag);
    });

    if (allowsAny) return MachineSideIo.acceptingAny();

    const types = tags
      .filter((tag) => {
        if (!tag.startsWith(IO_TYPE_TAG_PREFIX)) return false;
        return tagMatchesSide(tag);
      })
      .map((tag) => tag.slice(IO_TYPE_TAG_PREFIX.length).split(".")[0]);

    const categories = tags
      .filter((tag) => {
        if (!tag.startsWith(IO_CATEGORY_TAG_PREFIX)) return false;
        return tagMatchesSide(tag);
      })
      .map((tag) => tag.slice(IO_CATEGORY_TAG_PREFIX.length).split(".")[0]);

    return MachineSideIo.accepting(types, categories);
  }
}
