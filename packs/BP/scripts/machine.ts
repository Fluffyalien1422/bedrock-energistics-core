/**
 * Machine block lifecycle: placing/breaking a machine block is what creates and
 * tears down its persistent state. A machine's state lives in three places -
 * scoreboards (storage amounts, see data.ts), block dynamic properties (item
 * slot contents), and an attached entity (the UI container). This file keeps
 * those in sync with the block and triggers network rebuilds when the world
 * topology changes.
 */

import {
  Block,
  BlockCustomComponent,
  BlockPermutation,
  DimensionLocation,
  Entity,
  world,
} from "@minecraft/server";
import {
  getBlockUniqueId,
  getMachineSlotItemUnsafe,
  optionalMachineItemStackToItemStack,
  removeBlockFromScoreboards,
} from "./data";
import { clearItemSlotChanges } from "./ui";
import { MachineNetwork } from "./network";
import { raise, raisePublic } from "./log";
import { Vector3Utils } from "@minecraft/math";
import {
  getBlockNetworkConnectionType,
  NetworkConnectionType,
  PublicErrorType,
  RegisteredMachine,
} from "@/public_api/src";
import {
  getMachineIdFromEntityId,
  InternalRegisteredMachine,
} from "./machine_registry";
import { removeAllDynamicPropertiesForBlock } from "./utils/dynamic_property";
import { findEntityAtBlockLocation } from "@/public_api/src/misc_internal";

/**
 * Erases all persistent state associated with a machine location and forces
 * any network it belonged to be rebuilt.
 * @remarks
 * Does not touch the block itself or its entity - only the backing data. Used
 * both by {@link destroyMachine} and directly over IPC (a dependent add-on may
 * remove a machine's data without breaking the block).
 */
export function removeMachineData(
  loc: DimensionLocation,
  connectionType: NetworkConnectionType,
): void {
  // Destroying the network forces a fresh one to be established later without
  // this block, since the block's data is about to disappear.
  MachineNetwork.updateWith(loc, connectionType);
  removeBlockFromScoreboards(loc);
  removeAllDynamicPropertiesForBlock(loc);
  // The item slots those changes refer to no longer exist. The UI update
  // interval drops the entry too when it notices the entity has gone, but the
  // machine's data can also be removed with its entity left in place.
  clearItemSlotChanges(getBlockUniqueId(loc));
}

/**
 * Fully destroys a machine: drops its stored items, removes its data, removes
 * its attached entity, and (optionally) replaces the block.
 * @param destroyedPermutation The permutation to read the machine definition
 * from. Defaults to the block's current permutation; callers handling a break
 * event pass the broken permutation because the block is already air by then.
 * @param newBlockType The block type to set afterwards, or `false` to leave the
 * block as-is (e.g. when the block has already been broken).
 */
export function destroyMachine(
  block: Block,
  destroyedPermutation: BlockPermutation = block.permutation,
  newBlockType: string | false = "air",
): void {
  const definition = InternalRegisteredMachine.forceGetInternal(
    destroyedPermutation.type.id,
  );
  const connectionType = getBlockNetworkConnectionType(destroyedPermutation);
  if (connectionType === undefined) {
    raisePublic(
      PublicErrorType.InvalidArgument,
      `Failed to destroy machine. Could not get network connection type for block '${destroyedPermutation.type.id}'.`,
    );
  }
  dropItemsStoredInMachine(block, definition);
  removeMachineData(block, connectionType);

  // Remove the machine's attached UI entity, if one is present at the block.
  findEntityAtBlockLocation(block, definition.entityId)?.remove();
  if (newBlockType !== false) block.setType(newBlockType);
}

/**
 * Spawns the entity that backs a machine's UI, anchored at the block. The
 * entity's inventory container is what the player actually sees when opening
 * the machine (see ui.ts).
 */
function spawnMachineEntity(
  block: Block,
  definition: RegisteredMachine,
): Entity {
  // there is a similar function to this one in the public api.
  // if this is changed, then ensure the public api function is
  // changed as well.
  const entity = block.dimension.spawnEntity(
    definition.entityId,
    block.bottomCenter(),
  );
  entity.nameTag = definition.defaultEntityNameTag;
  return entity;
}

/**
 * Spawns each item held in the machine's item-slot UI elements into the world.
 * Called on destruction so stored items aren't lost.
 */
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

/**
 * Custom component for machine blocks that don't open a UI on interaction (or
 * that handle interaction themselves). Keeps networks and the backing entity in
 * sync with the block's placement and removal.
 */
export const machineNoInteractComponent: BlockCustomComponent = {
  onPlace(e) {
    // A new block may bridge or extend adjacent networks; force them to rebuild.
    MachineNetwork.updateAdjacent(e.block);

    const definition = InternalRegisteredMachine.forceGetInternal(
      e.block.typeId,
    );
    // Persistent-entity machines keep their UI entity alive at all times;
    // spawn it up front rather than lazily on interaction.
    if (definition.persistentEntity) {
      spawnMachineEntity(e.block, definition);
    }
  },
  onBreak(e) {
    // The block is already air, so read the machine definition
    // from the broken permutation.
    destroyMachine(e.block, e.brokenBlockPermutation, false);
  },
};

/**
 * Custom component for interactive machine blocks. Extends
 * {@link machineNoInteractComponent} by lazily spawning the UI entity when a
 * player interacts with the block.
 */
export const machineComponent: BlockCustomComponent = {
  ...machineNoInteractComponent,
  onPlayerInteract(e) {
    const definition = InternalRegisteredMachine.forceGetInternal(
      e.block.typeId,
    );
    // Nothing to open if there's no UI; persistent-entity machines already have
    // their entity spawned in onPlace, so skip them too.
    if (!definition.uiElements || definition.persistentEntity) {
      return;
    }

    spawnMachineEntity(e.block, definition);
  },
};

// A machine's UI entity is normally hidden and non-interactable. When a player
// hits (attacks) a non-persistent machine entity, despawn it so it doesn't
// linger - it will be respawned on the next interaction. Persistent entities
// are left alone.
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
