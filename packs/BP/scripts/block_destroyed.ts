/**
 * Script for handling block destroy events for machines and conduits.
 * Destroy logic specific to conduits and machines can be found in their own files.
 */

import {
  DimensionLocation,
  Direction,
  Entity,
  system,
  Vector3,
  world,
} from "@minecraft/server";
import { removeBlockFromScoreboards } from "./data";
import { MachineNetwork } from "./network";
import { logWarn } from "./utils/log";
import { getDirectionVector, reverseDirection } from "./utils/direction";
import { Vector3Utils } from "@minecraft/math";
import { dropItemsStoredInMachine } from "./machine";
import { InternalNetworkLinkNode } from "./network_links/network_link_internal";
import { NETWORK_LINK_ENTITY_ID } from "@/public_api/src/network_links/ipc_events";
import {
  getBlockNetworkConnectionType,
  NetworkConnectionType,
} from "@/public_api/src";
import { InternalRegisteredMachine } from "./machine_registry";
import { removeAllDynamicPropertiesForBlock } from "./utils/dynamic_property";

world.afterEvents.blockExplode.subscribe((e) => {
  const connectionType = getBlockNetworkConnectionType(
    e.explodedBlockPermutation,
  );
  if (!connectionType) {
    return;
  }

  removeAllDynamicPropertiesForBlock(e.block);
  MachineNetwork.updateWith(e.block, connectionType);

  if (connectionType === NetworkConnectionType.Machine) {
    removeBlockFromScoreboards(e.block);
  } else if (connectionType === NetworkConnectionType.NetworkLink) {
    const link = InternalNetworkLinkNode.tryGetAt(e.dimension, e.block);
    if (!link) {
      logWarn(
        "blockExplode after event - couldn't get InternalNetworkLinkNode",
      );
      return;
    }
    link.destroyNode();
  }
});

world.afterEvents.pistonActivate.subscribe((e) => {
  const attachedBlockLocations = e.piston.getAttachedBlocksLocations();
  if (!attachedBlockLocations.length) return;

  const movedMachineEntities: Entity[] = [];
  const movedNetworkLinkEntities: Entity[] = [];

  for (const entity of e.dimension.getEntities({
    type: "fluffyalien_energisticscore:network_link",
    location: e.block.location,
    maxDistance: 15,
  })) {
    const originalLocation = entity.getDynamicProperty("block_location") as
      | Vector3
      | undefined;
    if (!originalLocation) {
      logWarn(
        `can't get network link entity moved by piston: '${entity.typeId}' does not have the 'block_location' dynamic property. skipping`,
      );
      continue;
    }

    entity.teleport(originalLocation);
    movedNetworkLinkEntities.push(entity);
  }

  for (const entity of e.dimension.getEntities({
    families: ["fluffyalien_energisticscore:machine_entity"],
    location: e.block.location,
    maxDistance: 15,
  })) {
    const originalLocation = entity.getDynamicProperty("block_location") as
      | Vector3
      | undefined;
    if (!originalLocation) {
      logWarn(
        `can't get machine entity moved by piston: '${entity.typeId}' does not have the 'block_location' dynamic property. skipping`,
      );
      continue;
    }

    entity.teleport(originalLocation);
    movedMachineEntities.push(entity);
  }

  const pistonDirections = [
    Direction.Down,
    Direction.Up,
    Direction.South,
    Direction.North,
    Direction.East,
    Direction.West,
  ];

  const facingDirection =
    pistonDirections[
      e.block.permutation.getState("facing_direction") as number
    ];

  const blockMovementDirection = e.isExpanding
    ? facingDirection
    : reverseDirection(facingDirection);

  const blockMovementVector = getDirectionVector(blockMovementDirection);

  system.runTimeout(() => {
    for (const attachedBlockLocation of attachedBlockLocations) {
      const newBlockLocation = Vector3Utils.add(
        attachedBlockLocation,
        blockMovementVector,
      );
      const block = e.dimension.getBlock(newBlockLocation);
      if (!block) continue;

      const connectionType = getBlockNetworkConnectionType(block);
      if (!connectionType) continue;

      const attachedBlockDimensionLocation: DimensionLocation = {
        dimension: e.dimension,
        ...attachedBlockLocation,
      };

      MachineNetwork.updateWith(attachedBlockDimensionLocation, connectionType);

      if (connectionType === NetworkConnectionType.Conduit) {
        continue;
      }

      if (connectionType === NetworkConnectionType.NetworkLink) {
        const entityIndex = movedNetworkLinkEntities.findIndex(
          (entity) =>
            entity.typeId === NETWORK_LINK_ENTITY_ID &&
            Vector3Utils.equals(
              attachedBlockLocation,
              entity.getDynamicProperty("block_location") as Vector3,
            ),
        );

        if (entityIndex !== -1) {
          const networkLinkEntity = movedNetworkLinkEntities[entityIndex];
          movedNetworkLinkEntities.splice(entityIndex, 1);
          InternalNetworkLinkNode.fromEntity(networkLinkEntity).destroyNode();
        }

        continue;
      }

      const definition = InternalRegisteredMachine.getInternal(block.typeId);
      if (!definition) {
        logWarn(
          `can't process pistonActivate event for block '${block.typeId}': this block uses the 'fluffyalien_energisticscore:machine' tag but it could not be found in the machine registry. skipping`,
        );
        continue;
      }

      const machineEntityIndex = movedMachineEntities.findIndex(
        (entity) =>
          entity.typeId === definition.entityId &&
          Vector3Utils.equals(
            attachedBlockLocation,
            entity.getDynamicProperty("block_location") as Vector3,
          ),
      );

      if (machineEntityIndex !== -1) {
        const machineEntity = movedMachineEntities[machineEntityIndex];
        movedMachineEntities.splice(machineEntityIndex, 1);

        if (definition.persistentEntity) {
          try {
            machineEntity.triggerEvent(
              "fluffyalien_energisticscore:on_destroyed_by_piston",
            );
          } catch (e) {
            logWarn(
              `error when trying to destroy machine '${block.typeId}' due to piston move: ${(e as Error).message}`,
            );
          }
        } else {
          machineEntity.remove();
        }
      }

      dropItemsStoredInMachine(attachedBlockDimensionLocation, definition);
      removeBlockFromScoreboards(attachedBlockDimensionLocation);
      removeBlockFromScoreboards(block);
      removeAllDynamicPropertiesForBlock(attachedBlockDimensionLocation);
      removeAllDynamicPropertiesForBlock(block);
      block.dimension.runCommand(
        `setblock ${block.x.toString()} ${block.y.toString()} ${block.z.toString()} air destroy`,
      );
    }
  }, 2);
});
