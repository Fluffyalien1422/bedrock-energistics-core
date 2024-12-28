import * as ipc from "mcbe-addon-ipc";
import { world } from "@minecraft/server";
import { logInfo, raise } from "./utils/log";
import {
  RegisteredStorageType,
  STANDARD_STORAGE_TYPE_DEFINITIONS,
  StorageTypeDefinition,
} from "@/public_api/src";

const storageTypeRegistry = new Map<string, InternalRegisteredStorageType>();

// @ts-expect-error extending private class for internal use
export class InternalRegisteredStorageType extends RegisteredStorageType {
  // override to make it public
  public constructor(definition: StorageTypeDefinition) {
    super(definition);
  }

  getDefinition(): StorageTypeDefinition {
    return this.definition;
  }

  static getInternal(id: string): InternalRegisteredStorageType | undefined {
    return storageTypeRegistry.get(id);
  }

  static forceGetInternal(id: string): InternalRegisteredStorageType {
    const registered = InternalRegisteredStorageType.getInternal(id);
    if (!registered) {
      raise(
        `Expected '${id}' to be registered as a storage type, but it could not be found in the storage type registry.`,
      );
    }
    return registered;
  }
}

// register energy by default
registerStorageType(STANDARD_STORAGE_TYPE_DEFINITIONS.energy);

function registerStorageType(data: StorageTypeDefinition): void {
  if (storageTypeRegistry.has(data.id)) {
    logInfo(`overrode storage type '${data.id}'`);
  }

  const registered = new InternalRegisteredStorageType(data);
  storageTypeRegistry.set(data.id, registered);

  const objectiveId = `fluffyalien_energisticscore:storage${data.id}`;

  if (!world.scoreboard.getObjective(objectiveId)) {
    world.scoreboard.addObjective(objectiveId);
  }
}

export function registerStorageTypeListener(
  payload: ipc.SerializableValue,
): null {
  const data = payload as StorageTypeDefinition;
  registerStorageType(data);
  return null;
}
