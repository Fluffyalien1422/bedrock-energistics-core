import { BecIpcListener } from "./bec_ipc_listener.js";
import { ipcInvoke, ipcSend } from "./ipc_wrapper.js";
import { raise } from "./log.js";
import { isRegistrationAllowed } from "./registration_allowed.js";
import {
  StorageTypeTextureDescription,
  StorageTypeTexturePreset,
  StorageTypeDefinition,
} from "./storage_type_registry_types.js";

/**
 * value should be `undefined` if the storage type does not exist
 */
const storageTypeCache = new Map<string, RegisteredStorageType | undefined>();
let storageTypeIdCache: string[] | undefined;

const ownRegisteredStorageTypes = new Map<string, RegisteredStorageType>();

/**
 * @beta
 */
export interface StorageTypeData {
  id: string;
  category: string;
}

/**
 * Representation of a storage type definition that has been registered.
 * @beta
 * @see {@link StorageTypeDefinition}, {@link registerStorageType}
 */
export class RegisteredStorageType implements StorageTypeData {
  private constructor(
    /**
     * @internal
     */
    protected readonly definition: StorageTypeDefinition,
  ) {}

  /**
   * @returns The ID of this storage type.
   * @beta
   */
  get id(): string {
    return this.definition.id;
  }

  /**
   * @returns The category of this storage type.
   * @beta
   */
  get category(): string {
    return this.definition.category;
  }

  /**
   * @returns The texture preset or description of this storage type.
   * @beta
   */
  get texture(): StorageTypeTextureDescription | StorageTypeTexturePreset {
    return this.definition.texture;
  }

  /**
   * @returns The name of this storage type.
   * @beta
   */
  get name(): string {
    return this.definition.name;
  }

  /**
   * Get a storage type registered by this pack by its ID.
   * @beta
   * @remarks
   * This will only include storage types that have been registered by this pack. If a storage type registered by this pack has been overriden by another pack, this will return the original version registered by this pack. Use {@link RegisteredStorageType.get} to get storage types registered by any pack.
   * @param id The ID of the storage type to get.
   * @returns The registered storage type, or `undefined` if it does not exist.
   */
  static getOwn(id: string): RegisteredStorageType | undefined {
    return ownRegisteredStorageTypes.get(id);
  }

  /**
   * Get all storage type IDs registered by this pack.
   * @beta
   * @remarks
   * This will only include storage types that have been registered by this pack. Use {@link RegisteredStorageType.getAllIds} to get storage types registered by any pack.
   * @returns An array containing all local registered storage type IDs.
   */
  static getOwnIds(): string[] {
    return [...ownRegisteredStorageTypes.keys()];
  }

  /**
   * Get a registered storage type by its ID.
   * @beta
   * @param id The ID of the storage type to get.
   * @returns The registered storage type, or `undefined` if it does not exist.
   */
  static async get(id: string): Promise<RegisteredStorageType | undefined> {
    if (storageTypeCache.has(id)) {
      return storageTypeCache.get(id);
    }

    const isRegistrationOngoing = isRegistrationAllowed();
    // if registration is still ongoing, check own registered storage types first.
    // we don't want to do this if registration has ended, since the storage type
    // may have been overriden by another pack.
    if (isRegistrationOngoing && ownRegisteredStorageTypes.has(id)) {
      return ownRegisteredStorageTypes.get(id);
    }

    const def = (await ipcInvoke(
      BecIpcListener.GetRegisteredStorageType,
      id,
    )) as StorageTypeDefinition | null;

    const result = def ? new RegisteredStorageType(def) : undefined;

    if (!isRegistrationOngoing) {
      storageTypeCache.set(id, result);
    }

    return result;
  }

  /**
   * Get all registered storage type IDs.
   * @beta
   * @returns An array containing all registered storage type IDs.
   */
  static async getAllIds(): Promise<string[]> {
    if (storageTypeIdCache) {
      return [...storageTypeIdCache];
    }

    const ids = (await ipcInvoke(
      BecIpcListener.GetAllRegisteredStorageTypes,
      null,
    )) as string[];

    if (!isRegistrationAllowed()) {
      storageTypeIdCache = [...ids];
    }

    return ids;
  }
}

/**
 * Registers a storage type. This function should be called in the `worldInitialize` after event.
 * @beta
 * @throws Throws if registration has been closed.
 * @throws Throws if the definition ID or category is invalid.
 */
export function registerStorageType(definition: StorageTypeDefinition): void {
  if (!isRegistrationAllowed()) {
    raise(
      `Attempted to register storage type '${definition.id}' after registration was closed.`,
    );
  }

  if (definition.id.startsWith("_") || definition.category.startsWith("_")) {
    raise(
      `Failed to register storage type '${definition.id}' (category: '${definition.category}'). Storage type IDs and categories cannot start with '_'.`,
    );
  }

  if (definition.id.includes(".") || definition.category.includes(".")) {
    raise(
      `Failed to register storage type '${definition.id}' (category: '${definition.category}'). Storage type IDs and categories cannot include '.'.`,
    );
  }

  // reconstruct the definition in case the passed `definition` contains unnecessary keys
  const payload: StorageTypeDefinition = {
    id: definition.id,
    category: definition.category,
    texture: definition.texture,
    name: definition.name,
  };
  ownRegisteredStorageTypes.set(
    payload.id,
    // @ts-expect-error - internal use of private constructor
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    new RegisteredStorageType(payload),
  );

  ipcSend(BecIpcListener.RegisterStorageType, payload);
}
