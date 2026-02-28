import {
  Block,
  BlockPermutation,
  DimensionLocation,
  Entity,
} from "@minecraft/server";
import { ipcInvoke } from "./ipc_wrapper.js";
import { BecIpcListener } from "./bec_ipc_listener.js";
import { makeSerializableDimensionLocation } from "./serialize_utils.js";
import { RegisteredMachine } from "./machine_registry.js";
import { RemoveMachineDataPayload } from "./machine_data_internal.js";
import { getBlockNetworkConnectionType } from "./network_utils.js";
import { raise } from "./log.js";

/**
 * Cleans up machine data and updates networks.
 * @beta
 * @remarks
 * This is automatically done by Bedrock Energistics Core when a machine block is broken.
 * If you destroy a machine from script, make sure you call this function.
 * This function will not remove the block or the entity, it only removes data.
 * If you want to remove the block and entity as well, use {@link destroyMachine} instead.
 * @param loc The machine block location.
 * @param destroyedPermutation The permutation of the block that was destroyed. If the block hasn't been destroyed, pass the current permutation of the block.
 */
export async function removeMachineData(
  loc: DimensionLocation,
  destroyedPermutation: BlockPermutation,
): Promise<void> {
  const connectionType = getBlockNetworkConnectionType(destroyedPermutation);
  if (!connectionType) {
    raise(
      `Failed to remove machine data. Could not get network connection type for block '${destroyedPermutation.type.id}'.`,
    );
  }
  const payload: RemoveMachineDataPayload = {
    loc: makeSerializableDimensionLocation(loc),
    connectionType,
  };
  await ipcInvoke(BecIpcListener.RemoveMachineData, payload);
}

/**
 * Destroys the machine at the specified location, removing all data, dropping items stored in the machine, and removing the block and entity.
 * @beta
 * @remarks
 * This will destroy the block and remove the machine entity. If you only want to remove data, use {@link removeMachineData} instead.
 * @param loc The machine block location.
 */
export async function destroyMachine(loc: DimensionLocation): Promise<void> {
  await ipcInvoke(
    BecIpcListener.DestroyMachine,
    makeSerializableDimensionLocation(loc),
  );
}

/**
 * Gets the machine entity for the specified block, if it exists.
 * @param block The machine.
 * @returns The machine entity, or `undefined` if it doesn't exist.
 * @throws Throws if the machine does not exist in the registry.
 */
export async function getMachineEntity(
  block: Block,
): Promise<Entity | undefined> {
  const definition = await RegisteredMachine.forceGet(block.typeId);
  const existingEntity = block.dimension
    .getEntitiesAtBlockLocation(block.location)
    .find((entity) => entity.typeId === definition.entityId);
  return existingEntity;
}

/**
 * Spawns the machine entity for the machine at the specified location, if it doesn't already exist.
 * @param block The machine.
 * @returns The new entity or the one that was already there.
 * @throws Throws if the machine does not exist in the registry.
 */
export async function spawnMachineEntity(block: Block): Promise<Entity> {
  // there is a similar function to this one in the add-on.
  // if this is changed, then ensure the add-on function is
  // changed as well.

  const definition = await RegisteredMachine.forceGet(block.typeId);

  const existingEntity = block.dimension
    .getEntitiesAtBlockLocation(block.location)
    .find((entity) => entity.typeId === definition.entityId);
  if (existingEntity) return existingEntity;

  const newEntity = block.dimension.spawnEntity(
    definition.entityId,
    block.bottomCenter(),
  );
  newEntity.nameTag = block.typeId;
  return newEntity;
}
