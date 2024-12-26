import { ipcInvoke, ipcSend } from "./ipc_wrapper.js";
import { StorageTypeColor, StorageTypeDefinition } from "./registry_types.js";
import { MangledStorageTypeDefinition } from "./storage_type_registry_internal.js";

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
  /**
   * @internal
   */
  constructor(
    /**
     * @internal
     */
    protected readonly internal: MangledStorageTypeDefinition,
  ) {}

  /**
   * @returns The ID of this storage type.
   * @beta
   */
  get id(): string {
    return this.internal.a;
  }

  /**
   * @returns The category of this storage type.
   * @beta
   */
  get category(): string {
    return this.internal.b;
  }

  /**
   * @returns The {@link StorageTypeColor} of this storage type.
   * @beta
   */
  get color(): StorageTypeColor {
    return this.internal.c;
  }

  /**
   * @returns The name of this storage type.
   * @beta
   */
  get name(): string {
    return this.internal.d;
  }

  /**
   * Gets a registered storage type.
   * @beta
   * @param id The ID of the storage type.
   * @returns The {@link RegisteredStorageType} with the specified ID or `undefined` if it doesn't exist.
   * @throws if Bedrock Energistics Core takes too long to respond.
   */
  static async get(id: string): Promise<RegisteredStorageType | undefined> {
    const mangled = (await ipcInvoke(
      "fluffyalien_energisticscore:ipc.registeredStorageTypeGet",
      id,
    )) as MangledStorageTypeDefinition | null;

    if (!mangled) return;

    return new RegisteredStorageType(mangled);
  }
}

/**
 * Registers a storage type. This function should be called in the `worldInitialize` after event.
 * @beta
 */
export function registerStorageType(definition: StorageTypeDefinition): void {
  if (definition.id.startsWith("_") || definition.category.startsWith("_")) {
    throw new Error(
      `can't register storage type '${definition.id}' (category: '${definition.category}'): storage type IDs and categories cannot start with '_'`,
    );
  }

  // reconstruct the definition in case the passed `definition` contains unnecessary keys
  const payload: MangledStorageTypeDefinition = {
    a: definition.id,
    b: definition.category,
    c: definition.color,
    d: definition.name,
  };

  ipcSend("fluffyalien_energisticscore:ipc.registerStorageType", payload);
}
