import * as ipc from "mcbe-addon-ipc";
import { world } from "@minecraft/server";
import { logInfo, raise } from "./utils/log";
import {
  RegisteredStorageType,
  STANDARD_STORAGE_TYPE_DEFINITIONS,
  StorageTypeDefinition,
} from "@/public_api/src";
import { MangledStorageTypeDefinition } from "@/public_api/src/storage_type_registry_internal";

export class InternalRegisteredStorageType extends RegisteredStorageType {
  get mangled(): MangledStorageTypeDefinition {
    return this.internal;
  }

  static getInternal(id: string): InternalRegisteredStorageType | undefined {
    return storageTypeRegistry[id];
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

const storageTypeRegistry: Record<string, InternalRegisteredStorageType> = {};

// register energy by default
registerStorageType(
  makeRegisteredStorageTypeFromDefinition(
    STANDARD_STORAGE_TYPE_DEFINITIONS.energy,
  ),
);

function makeRegisteredStorageTypeFromDefinition(
  def: StorageTypeDefinition,
): InternalRegisteredStorageType {
  return new InternalRegisteredStorageType({
    a: def.id,
    b: def.category,
    c: def.color,
    d: def.name,
  });
}

function registerStorageType(data: InternalRegisteredStorageType): void {
  if (data.id in storageTypeRegistry) {
    logInfo(`overrode storage type '${data.id}'`);
  }

  storageTypeRegistry[data.id] = data;

  const objectiveId = `fluffyalien_energisticscore:storage${data.id}`;

  if (!world.scoreboard.getObjective(objectiveId)) {
    world.scoreboard.addObjective(objectiveId);
  }
}

export function registerStorageTypeListener(
  payload: ipc.SerializableValue,
): null {
  const mData = payload as MangledStorageTypeDefinition;
  const data = new InternalRegisteredStorageType(mData);
  registerStorageType(data);
  return null;
}
