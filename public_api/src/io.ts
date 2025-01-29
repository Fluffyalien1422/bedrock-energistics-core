import { Block, Direction } from "@minecraft/server";
import {
  RegisteredStorageType,
  StorageTypeData,
} from "./storage_type_registry.js";

const IO_TYPE_TAG_PREFIX = "fluffyalien_energisticscore:io.type.";
const IO_CATEGORY_TAG_PREFIX = "fluffyalien_energisticscore:io.category.";
const IO_ANY_TAG = "fluffyalien_energisticscore:io.any";
const IO_EXPLICIT_SIDES_TAG = "fluffyalien_energisticscore:explicit_sides";
const IO_REQUIRE_CONDUIT_CONNECTIONS_TAG =
  "fluffyalien_energisticscore:require_conduit_connection";

/**
 * @beta
 */
export interface IoCapabilitiesData {
  acceptsAny: boolean;
  types: string[];
  categories: string[];
  onlyAllowConduitConnections: boolean;
}

/**
 * Represents input/output capabilities of a machine side or item machine.
 * @beta
 */
export class IoCapabilities {
  /**
   * Note: {@link IoCapabilities.accepting} or {@link IoCapabilities.acceptingAny}
   * should be used to create an instance instead.
   * @beta
   */
  constructor(private readonly data: IoCapabilitiesData) {}

  /**
   * @beta
   * @returns Returns whether this object only accepts conduit connections
   */
  get onlyAllowsConduitConnections(): boolean {
    return this.data.onlyAllowConduitConnections;
  }

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
  get types(): string[] {
    return [...this.data.types];
  }

  /**
   * @beta
   * @returns Returns the accepted categories (empty if the object accepts any).
   */
  get categories(): string[] {
    return [...this.data.categories];
  }

  /**
   * Check if this object accepts the given storage type.
   * @beta
   * @param storageType The storage type data to check.
   * @param isFromConduit Is the source a conduit
   * @returns Whether this object accepts the given storage type.
   */
  acceptsType(storageType: StorageTypeData, isFromConduit: boolean): boolean {
    if (!isFromConduit && this.onlyAllowsConduitConnections) return false;

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
   * @param isFromConduit Is the sender a conduit
   * @returns Whether this object accepts the storage type with the given ID.
   */
  async acceptsTypeWithId(
    id: string,
    isFromConduit: boolean,
  ): Promise<boolean> {
    if (!isFromConduit && this.onlyAllowsConduitConnections) return false;
    if (this.acceptsAny) return true;

    const storageType = await RegisteredStorageType.get(id);
    if (!storageType) return false;

    return this.acceptsType(storageType, isFromConduit);
  }

  /**
   * Check if this object accepts the given category.
   * @beta
   * @param category The category to check.
   * @param isFromConduit Is the sender a conduit
   * @returns Whether this object accepts the given category.
   */
  acceptsCategory(category: string, isFromConduit: boolean): boolean {
    if (!isFromConduit && this.onlyAllowsConduitConnections) return false;
    return this.acceptsAny || this.categories.includes(category);
  }

  /**
   * Check if this object accepts any storage type of the given category.
   * @beta
   * @param category The category to check.
   * @returns Whether this object accepts any storage type of the given category.
   */
  async acceptsAnyTypeOfCategory(
    category: string,
    isFromConduit: boolean,
  ): Promise<boolean> {
    if (!isFromConduit && this.onlyAllowsConduitConnections) return false;
    if (this.acceptsCategory(category, isFromConduit)) return true;

    for (const type of this.types) {
      const storageType = await RegisteredStorageType.get(type);
      if (storageType?.category === category) return true;
    }

    return false;
  }

  /**
   * Create a new IoCapabilities object that accepts the given types and categories.
   * @beta
   * @param types Accepted type IDs.
   * @param categories Accepted categories.
   * @param onlyAllowConduitConnections Are only conduits allowed to connect?
   * @returns Returns a new IoCapabilities object.
   */
  static accepting(
    types: string[],
    categories: string[],
    onlyAllowConduitConnections: boolean,
  ): IoCapabilities {
    return new IoCapabilities({
      acceptsAny: false,
      types,
      categories,
      onlyAllowConduitConnections,
    });
  }

  /**
   * Create a new IoCapabilities object that accepts any type or category.
   * @beta
   * @returns Returns a new IoCapabilities object.
   */
  static acceptingAny(onlyAllowConduitConnections: boolean): IoCapabilities {
    return new IoCapabilities({
      onlyAllowConduitConnections,
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
   * @returns A IoCapabilities object.
   */
  static fromMachine(machine: Block, side: Direction): IoCapabilities {
    const tags = machine.getTags();
    const onlyAllowsConduitConnections = tags.includes(
      IO_REQUIRE_CONDUIT_CONNECTIONS_TAG,
    );

    // Check if the machine uses explicit side IO.
    if (tags.includes(IO_EXPLICIT_SIDES_TAG)) {
      return IoCapabilities.fromMachineWithExplicitSides(
        tags,
        side,
        onlyAllowsConduitConnections,
      );
    }

    if (tags.includes(IO_ANY_TAG)) {
      return IoCapabilities.acceptingAny(onlyAllowsConduitConnections);
    }

    const types = tags
      .filter((tag) => tag.startsWith(IO_TYPE_TAG_PREFIX))
      .map((tag) => tag.slice(IO_TYPE_TAG_PREFIX.length));

    const categories = tags
      .filter((tag) => tag.startsWith(IO_CATEGORY_TAG_PREFIX))
      .map((tag) => tag.slice(IO_CATEGORY_TAG_PREFIX.length));

    return IoCapabilities.accepting(
      types,
      categories,
      onlyAllowsConduitConnections,
    );
  }

  private static fromMachineWithExplicitSides(
    tags: string[],
    side: Direction,
    onlyAllowsConduitConnections: boolean,
  ): IoCapabilities {
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

    if (allowsAny)
      return IoCapabilities.acceptingAny(onlyAllowsConduitConnections);

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

    return IoCapabilities.accepting(
      types,
      categories,
      onlyAllowsConduitConnections,
    );
  }
}
