import * as ipc from "mcbe-addon-ipc";
import { world } from "@minecraft/server";
import { logWarn, raise } from "./utils/log";
import {
  RegisteredStorageType,
  STANDARD_STORAGE_TYPE_DEFINITIONS,
  StorageTypeDefinition,
  StorageTypeTextureDescription,
  StorageTypeTexturePreset,
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

  static getAllIdsInternal(): MapIterator<string> {
    return storageTypeRegistry.keys();
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
world.afterEvents.worldLoad.subscribe(() => {
  registerStorageType(STANDARD_STORAGE_TYPE_DEFINITIONS.energy);
});

function prettifyStorageTypeTexture(
  texture: StorageTypeTextureDescription | StorageTypeTexturePreset,
): string {
  const typeName =
    typeof texture === "string"
      ? "StorageTypeTexturePreset"
      : "StorageTypeTextureDescription";
  return `${typeName} ${JSON.stringify(texture)}`;
}

function registerStorageType(data: StorageTypeDefinition): void {
  const existing = storageTypeRegistry.get(data.id);

  if (existing !== undefined) {
    if (existing.category !== data.category) {
      logWarn(
        `Overrode category of storage type '${data.id}', originally was '${existing.category}', now is '${data.category}'.`,
      );
    }

    if (existing.texture !== data.texture) {
      logWarn(
        `Overrode texture of storage type '${data.id}', originally was ${prettifyStorageTypeTexture(existing.texture)}, now is ${prettifyStorageTypeTexture(data.texture)}.`,
      );
    }

    if (existing.name !== data.name) {
      logWarn(
        `Overrode name of storage type '${data.id}', originally was '${existing.name}', now is '${data.name}'.`,
      );
    }
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
