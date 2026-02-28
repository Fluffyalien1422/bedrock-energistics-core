import {
  Block,
  BlockCustomComponent,
  BlockPermutation,
  DimensionLocation,
  Entity,
  world,
} from "@minecraft/server";
import {
  getMachineSlotItemUnsafe,
  optionalMachineItemStackToItemStack,
  removeBlockFromScoreboards,
} from "./data";
import { MachineNetwork } from "./network";
import { raise } from "./utils/log";
import { Vector3Utils } from "@minecraft/math";
import {
  getBlockNetworkConnectionType,
  NetworkConnectionType,
  RegisteredMachine,
} from "@/public_api/src";
import {
  getMachineIdFromEntityId,
  InternalRegisteredMachine,
} from "./machine_registry";
import { removeAllDynamicPropertiesForBlock } from "./utils/dynamic_property";

export function removeMachineData(
  loc: DimensionLocation,
  connectionType: NetworkConnectionType,
): void {
  MachineNetwork.updateWith(loc, connectionType);
  removeBlockFromScoreboards(loc);
  removeAllDynamicPropertiesForBlock(loc);
}

export function destroyMachine(
  block: Block,
  destroyedPermutation: BlockPermutation = block.permutation,
  newBlockType: string | false = "air",
): void {
  const definition = InternalRegisteredMachine.forceGetInternal(
    destroyedPermutation.type.id,
  );
  const connectionType = getBlockNetworkConnectionType(destroyedPermutation);
  if (!connectionType) {
    raise(
      `Failed to destroy machine. Could not get network connection type for block '${destroyedPermutation.type.id}'.`,
    );
  }
  dropItemsStoredInMachine(block, definition);
  removeMachineData(block, connectionType);

  block.dimension
    .getEntitiesAtBlockLocation(block)
    .find((entity) => entity.typeId === definition.entityId)
    ?.remove();
  if (newBlockType) block.setType(newBlockType);
}

function spawnMachineEntity(block: Block, entityId: string): Entity {
  // there is a similar function to this one in the public api.
  // if this is changed, then ensure the public api function is
  // changed as well.
  const entity = block.dimension.spawnEntity(entityId, block.bottomCenter());
  entity.nameTag = block.typeId;
  return entity;
}

function dropItemsStoredInMachine(
  blockLocation: DimensionLocation,
  definition: RegisteredMachine,
): void {
  if (!definition.uiElements) {
    return;
  }

  for (const [elementId, element] of definition.uiElements) {
    if (element.type !== "itemSlot") continue;

    const item = getMachineSlotItemUnsafe(blockLocation, elementId);
    if (item) {
      blockLocation.dimension.spawnItem(
        optionalMachineItemStackToItemStack(item),
        Vector3Utils.add(blockLocation, { x: 0.5, y: 0.5, z: 0.5 }),
      );
    }
  }
}

export const machineNoInteractComponent: BlockCustomComponent = {
  onPlace(e) {
    MachineNetwork.updateAdjacent(e.block);

    const definition = InternalRegisteredMachine.forceGetInternal(
      e.block.typeId,
    );
    if (definition.persistentEntity) {
      spawnMachineEntity(e.block, definition.entityId);
    }
  },
  onBreak(e) {
    destroyMachine(e.block, e.brokenBlockPermutation, false);
  },
};

export const machineComponent: BlockCustomComponent = {
  ...machineNoInteractComponent,
  onPlayerInteract(e) {
    const definition = InternalRegisteredMachine.forceGetInternal(
      e.block.typeId,
    );
    if (!definition.uiElements || definition.persistentEntity) {
      return;
    }

    spawnMachineEntity(e.block, definition.entityId);
  },
};

world.afterEvents.entityHitEntity.subscribe((e) => {
  if (
    e.damagingEntity.typeId !== "minecraft:player" ||
    !e.hitEntity.isValid ||
    !e.hitEntity
      .getComponent("type_family")
      ?.hasTypeFamily("fluffyalien_energisticscore:machine_entity")
  ) {
    return;
  }

  const machineId = getMachineIdFromEntityId(e.hitEntity.typeId);
  if (!machineId) {
    raise(
      `The entity '${e.hitEntity.typeId}' has the 'fluffyalien_energisticscore:machine_entity' type family but it is not attached to a machine block.`,
    );
  }

  const definition = InternalRegisteredMachine.forceGetInternal(machineId);
  if (definition.persistentEntity) {
    return;
  }

  e.hitEntity.remove();
});
