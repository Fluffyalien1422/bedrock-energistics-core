import { Block } from "@minecraft/server";
import {
  RegisteredStorageType,
  StorageTypeData,
} from "./storage_type_registry.js";

const IO_TYPE_TAG_PREFIX = "fluffyalien_energisticscore:io.type.";
const IO_CATEGORY_TAG_PREFIX = "fluffyalien_energisticscore:io.category.";

interface MachineIoData {
  acceptsAny: boolean;
  types: string[];
  categories: string[];
}

/**
 * An object that represents the input/output capabilities of a machine.
 * @beta
 */
export class MachineIo {
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
   * Create a new MachineIo object that accepts the given types and categories.
   * @beta
   * @param types Accepted type IDs.
   * @param categories Accepted categories.
   * @returns Returns a new MachineIo object.
   */
  static accepting(types: string[], categories: string[]): MachineIo {
    return new MachineIo({
      acceptsAny: false,
      types,
      categories,
    });
  }

  /**
   * Create a new MachineIo object that accepts any type or category.
   * @beta
   * @returns Returns a new MachineIo object.
   */
  static acceptingAny(): MachineIo {
    return new MachineIo({
      acceptsAny: true,
      types: [],
      categories: [],
    });
  }

  /**
   * Get the input/output capabilities of a machine.
   * @beta
   * @param machine The machine.
   * @returns A MachineIo object.
   */
  static fromMachine(machine: Block): MachineIo {
    const tags = machine.getTags();

    if (tags.includes("fluffyalien_energisticscore:io.any")) {
      return MachineIo.acceptingAny();
    }

    const types = tags
      .filter((tag) => tag.startsWith(IO_TYPE_TAG_PREFIX))
      .map((tag) => tag.slice(IO_TYPE_TAG_PREFIX.length));
    const categories = tags
      .filter((tag) => tag.startsWith(IO_CATEGORY_TAG_PREFIX))
      .map((tag) => tag.slice(IO_CATEGORY_TAG_PREFIX.length));

    return MachineIo.accepting(types, categories);
  }
}
