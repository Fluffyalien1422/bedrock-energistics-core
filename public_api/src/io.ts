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
 * Represents the input/output capabilities of a machine side or item machine.
 * @beta
 */
export class IoCapabilities {
  private constructor(
    /**
     * Does this object accept any type or category?
     * @beta
     */
    readonly acceptsAny: boolean,
    /**
     * Does this object only accept connections from conduits?
     * @beta
     * @remarks
     * This is `true` for machines when they have the 'fluffyalien_energisticscore:require_conduit_connection' tag.
     */
    readonly onlyAllowsConduitConnections: boolean,
    private readonly internalTypes: readonly string[] = [],
    private readonly internalCategories: readonly string[] = [],
  ) {}

  /**
   * The accepted type IDs. This is an empty array if {@link IoCapabilities.acceptsAny} is `true`.
   * @beta
   */
  get types(): string[] {
    return [...this.internalTypes];
  }

  /**
   * The accepted category IDs. This is an empty array if {@link IoCapabilities.acceptsAny} is `true`.
   * @beta
   */
  get categories(): string[] {
    return [...this.internalCategories];
  }

  /**
   * Check if this object accepts the given storage type. Use {@link IoCapabilities.acceptsTypeWithId} to check by ID.
   * @beta
   * @param storageType The storage type data to check.
   * @param isFromConduit Is the source a conduit?
   * @returns Whether this object accepts the given storage type.
   */
  acceptsType(storageType: StorageTypeData, isFromConduit = false): boolean {
    if (!isFromConduit && this.onlyAllowsConduitConnections) return false;

    return (
      this.acceptsAny ||
      this.internalCategories.includes(storageType.category) ||
      this.internalTypes.includes(storageType.id)
    );
  }

  /**
   * Get a storage type by it's ID and check if this object accepts it.
   * @beta
   * @param id The ID of the storage type.
   * @param isFromConduit Is the source a conduit?
   * @returns Whether this object accepts the storage type with the given ID.
   */
  async acceptsTypeWithId(id: string, isFromConduit = false): Promise<boolean> {
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
   * @param isFromConduit Is the source a conduit?
   * @returns Whether this object accepts the given category.
   */
  acceptsCategory(category: string, isFromConduit = false): boolean {
    if (!isFromConduit && this.onlyAllowsConduitConnections) return false;
    return this.acceptsAny || this.internalCategories.includes(category);
  }

  /**
   * Check if this object accepts any storage type of the given category.
   * @beta
   * @param category The category to check.
   * @returns Whether this object accepts any storage type of the given category.
   */
  async acceptsAnyTypeOfCategory(
    category: string,
    isFromConduit = false,
  ): Promise<boolean> {
    if (!isFromConduit && this.onlyAllowsConduitConnections) return false;
    if (this.acceptsCategory(category, isFromConduit)) return true;

    for (const type of this.internalTypes) {
      const storageType = await RegisteredStorageType.get(type);
      if (storageType?.category === category) return true;
    }

    return false;
  }

  /**
   * Create a new `IoCapabilities` object that accepts the given types and categories.
   * @beta
   * @param types Accepted type IDs.
   * @param categories Accepted categories.
   * @param onlyAllowConduitConnections Only accept conduit connections?
   * @returns Returns a new `IoCapabilities` object.
   */
  static accepting(
    types: string[],
    categories: string[],
    onlyAllowConduitConnections = false,
  ): IoCapabilities {
    return new IoCapabilities(
      false,
      onlyAllowConduitConnections,
      [...types],
      [...categories],
    );
  }

  /**
   * Create a new `IoCapabilities` object that accepts any type or category.
   * @beta
   * @param onlyAllowConduitConnections Only accept conduit connections?
   * @returns Returns a new `IoCapabilities` object.
   */
  static acceptingAny(onlyAllowConduitConnections = false): IoCapabilities {
    return new IoCapabilities(true, onlyAllowConduitConnections);
  }

  /**
   * Get the input/output capabilities of a machine.
   * @beta
   * @param machine The machine.
   * @param side The side of the machine to check or "network_link" for linked connections.
   * @returns A new `IoCapabilities` object.
   */
  static fromMachine(
    machine: Block,
    side: Direction | "network_link",
  ): IoCapabilities {
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
    side: Direction | "network_link",
    onlyAllowsConduitConnections: boolean,
  ): IoCapabilities {
    const strDirection = side.toLowerCase();
    const isSideDirection =
      side !== Direction.Up &&
      side !== Direction.Down &&
      side !== "network_link";

    // "fluffyalien_energisticscore:io.{type|category}.<StorageTypeId>.{north|east|south|west|up|down|side|network_link}"
    // "fluffyalien_energisticscore:io.any.{north|east|south|west|up|down|side|network_link}"

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
