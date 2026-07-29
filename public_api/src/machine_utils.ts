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
import { raisePublic } from "./log.js";
import { PublicErrorType } from "./error.js";
import { findEntityAtBlockLocation } from "./misc_internal.js";

/**
 * If this tag is on a machine entity, no UI updates will be triggered.
 * Only use if you know what you're doing.
 * @beta
 */
export const MACHINE_ENTITY_NO_UPDATE_UI_TAG =
  "fluffyalien_energisticscore:no_update_ui";

/**
 * Cleans up machine data and updates networks.
 * @beta
 * @remarks
 * This is automatically done by Bedrock Energistics Core when a machine block is broken.
 * If you destroy a machine from script, make sure you call this function.
 * This function will not remove the block or the entity, it only removes data.
 * If you want to remove the block and entity as well, use {@link destroyMachine} instead.
 * @param loc The machine block OR its location (as a DimensionLocation).
 * @param destroyedPermutation The permutation of the block that was destroyed.
 * If the block hasn't been destroyed, pass the current permutation of the block.
 * If `loc` is of type `Block`, this is optional and will default to `loc.permutation`, otherwise it is required.
 * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidArgument} if arguments are invalid, or if the permutation has no network connection type (if {@link getBlockNetworkConnectionType} returns `undefined`).
 * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidState} if this package has not been initialized (see {@link init}).
 */
export async function removeMachineData(
  loc: DimensionLocation,
  destroyedPermutation: BlockPermutation,
): Promise<void>;
export async function removeMachineData(
  loc: Block,
  destroyedPermutation?: BlockPermutation,
): Promise<void>;
export async function removeMachineData(
  loc: DimensionLocation | Block,
  destroyedPermutation?: BlockPermutation,
): Promise<void> {
  let permutation = destroyedPermutation;
  if (!permutation) {
    if (loc instanceof Block) {
      permutation = loc.permutation;
    } else {
      raisePublic(
        PublicErrorType.InvalidArgument,
        "Invalid arguments passed to 'removeMachineData'. 'destroyedPermutation' must be defined if 'loc' is not of type 'Block'.",
      );
    }
  }

  const connectionType = getBlockNetworkConnectionType(permutation);
  if (connectionType === undefined) {
    raisePublic(
      PublicErrorType.InvalidArgument,
      `Failed to remove machine data. Could not get network connection type for block '${permutation.type.id}'.`,
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
 * @throws Throws a {@link PublicError} of type {@link PublicErrorType.NotFound} if there is no block at the given location.
 * @throws Throws a {@link PublicError} of type {@link PublicErrorType.NotRegistered} if the block is not registered as a machine.
 * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidArgument} if the block has no network connection type.
 * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidState} if this package has not been initialized (see {@link init}).
 */
export async function destroyMachine(loc: DimensionLocation): Promise<void> {
  await ipcInvoke(
    BecIpcListener.DestroyMachine,
    makeSerializableDimensionLocation(loc),
  );
}

/**
 * Gets the machine entity for the specified block, if it exists.
 * @beta
 * @param block The machine.
 * @returns The machine entity, or `undefined` if it doesn't exist.
 * @throws Throws a {@link PublicError} of type {@link PublicErrorType.NotRegistered} if the machine does not exist in the registry.
 * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidState} if this package has not been initialized (see {@link init}).
 */
export async function getMachineEntity(
  block: Block,
): Promise<Entity | undefined> {
  const definition = await RegisteredMachine.forceGet(block.typeId);
  return findEntityAtBlockLocation(block, definition.entityId);
}

/**
 * Spawns the machine entity for the machine at the specified location, if it doesn't already exist.
 * @beta
 * @param block The machine.
 * @returns The new entity or the one that was already there.
 * @throws Throws a {@link PublicError} of type {@link PublicErrorType.NotRegistered} if the machine does not exist in the registry.
 * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidState} if this package has not been initialized (see {@link init}).
 */
export async function spawnMachineEntity(block: Block): Promise<Entity> {
  // there is a similar function to this one in the add-on.
  // if this is changed, then ensure the add-on function is
  // changed as well.

  const definition = await RegisteredMachine.forceGet(block.typeId);

  const existingEntity = findEntityAtBlockLocation(block, definition.entityId);
  if (existingEntity) return existingEntity;

  const newEntity = block.dimension.spawnEntity(
    definition.entityId,
    block.bottomCenter(),
  );
  newEntity.nameTag = definition.defaultEntityNameTag;
  return newEntity;
}
