import { Block, DimensionLocation } from "@minecraft/server";
import {
  getBlockUniqueId,
  GetMachineSlotPayload,
  getScore,
  getStorageScoreboardObjective,
  SetMachineSlotPayload,
} from "./machine_data_internal.js";
import { makeSerializableDimensionLocation } from "./serialize_utils.js";
import { ipcInvoke, ipcSend } from "./ipc_wrapper.js";
import { BecIpcListener } from "./bec_ipc_listener.js";
import { raise } from "./log.js";
import { RegisteredMachine } from "./machine_registry.js";
import { callMachineOnStorageSetEvent } from "./machine_registry_internal.js";

/**
 * Representation of an item stack stored in a machine inventory.
 * @beta
 */
export interface MachineItemStack {
  /**
   * The type ID of the item.
   */
  typeId: string;
  /**
   * The amount of this item.
   */
  count: number;
}

/**
 * Gets the storage of a specific type in a machine.
 * @beta
 * @param loc The location of the machine.
 * @param type The type of storage to get.
 * @throws Throws if the storage type does not exist
 */
export function getMachineStorage(
  loc: DimensionLocation,
  type: string,
): number {
  const objective = getStorageScoreboardObjective(type);

  if (!objective) {
    raise(
      `Failed to get machine storage. Storage type '${type}' doesn't exist.`,
    );
  }

  return getScore(objective, getBlockUniqueId(loc)) ?? 0;
}

/**
 * Sets the storage of a specific type in a machine.
 * @beta
 * @param block The machine block.
 * @param type The type of storage to set.
 * @param value The new value. Must be an integer.
 * @param callOnStorageSet Whether to call the `onStorageSet` event on the machine, if applicable.
 * @throws Throws if the storage type does not exist.
 * @throws Throws if the new value isn't a non-negative integer.
 * @throws Throws if the block is not valid.
 * @throws Throws if the block is not registered as a machine.
 */
export async function setMachineStorage(
  block: Block,
  type: string,
  value: number,
  callOnStorageSet = true,
): Promise<void> {
  // There is a similar function to this in the add-on.
  // Make sure changes are reflected in both.

  // To avoid unnecessary IPC calls, this function calls the 'onStorageSet'
  // event on machines directly, without routing through Bedrock Energistics Core.
  // This also allows the local machine registry cache to be used, avoiding any
  // IPC calls for machines that don't have the 'onStorageSet' event.

  if (!block.isValid()) {
    raise("Failed to set machine storage. The block is invalid.");
  }

  if (value < 0) {
    raise(
      `Failed to set machine storage of type '${type}' to ${value.toString()}. The minimum value is 0.`,
    );
  }

  const objective = getStorageScoreboardObjective(type);
  if (!objective) {
    raise(
      `Failed to set machine storage. Storage type '${type}' doesn't exist.`,
    );
  }

  const registered = await RegisteredMachine.forceGet(block.typeId);

  objective.setScore(getBlockUniqueId(block), value);

  if (callOnStorageSet && registered.hasCallback("onStorageSet")) {
    callMachineOnStorageSetEvent(registered, block, type, value);
  }
}

/**
 * Gets an item from a machine inventory.
 * @beta
 * @param loc The location of the machine.
 * @param slotId The number ID of the slot as defined when the machine was registered (see {@link UiItemSlotElementDefinition}).
 * @returns The {@link MachineItemStack} or `null` if there is no item in the specified slot.
 */
export function getMachineSlotItem(
  loc: DimensionLocation,
  slotId: number,
): Promise<MachineItemStack | null> {
  const payload: GetMachineSlotPayload = {
    loc: makeSerializableDimensionLocation(loc),
    slot: slotId,
  };

  return ipcInvoke(
    BecIpcListener.GetMachineSlot,
    payload,
  ) as Promise<MachineItemStack | null>;
}

/**
 * Sets an item in a machine inventory.
 * @beta
 * @param loc The location of the machine.
 * @param slotId The number ID of the slot as defined when the machine was registered (see {@link UiItemSlotElementDefinition}).
 * @param newItemStack The {@link MachineItemStack} to put in the slot. Pass `undefined` to remove the item in the slot.
 */
export function setMachineSlotItem(
  loc: DimensionLocation,
  slotId: number,
  newItemStack?: MachineItemStack,
): void {
  const payload: SetMachineSlotPayload = {
    loc: makeSerializableDimensionLocation(loc),
    slot: slotId,
    item: newItemStack,
  };

  ipcSend(BecIpcListener.SetMachineSlot, payload);
}
