import { Block, DimensionLocation } from "@minecraft/server";
import {
  getBlockUniqueId,
  getItemCountScoreboardObjective,
  getItemTypeScoreboardObjective,
  getScore,
  getStorageScoreboardObjective,
} from "./machine_data_internal.js";
import { makeErrorString } from "./log.js";
import { makeSerializableDimensionLocation } from "./serialize_utils.js";
import { ipcSend } from "./ipc_wrapper.js";

/**
 * Representation of an item stack stored in a machine inventory.
 * @beta
 */
export interface MachineItemStack {
  /**
   * The index of the item in the slot's `allowedItems`.
   * @see {@link UiItemSlotElement}
   */
  typeIndex: number;
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
    throw new Error(
      makeErrorString(
        `trying to get machine storage of type '${type}' but that storage type does not exist`,
      ),
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
 * @throws Throws if the storage type does not exist.
 * @throws Throws if the new value isn't a non-negative integer.
 * @throws Throws if the block is not valid
 */
export function setMachineStorage(
  block: Block,
  type: string,
  value: number,
): void {
  if (!block.isValid()) {
    throw new Error(
      makeErrorString(
        `trying to set machine storage but the block is not valid`,
      ),
    );
  }

  if (value < 0) {
    throw new Error(
      makeErrorString(
        `trying to set machine storage of type '${type}' to ${value.toString()} which is less than the minimum value (0)`,
      ),
    );
  }

  const objective = getStorageScoreboardObjective(type);
  if (!objective) {
    throw new Error(
      makeErrorString(
        `trying to set machine storage of type '${type}' but that storage type does not exist`,
      ),
    );
  }

  objective.setScore(getBlockUniqueId(block), value);
}

/**
 * Gets an item from a machine inventory.
 * @beta
 * @param loc The location of the machine.
 * @param slotId The number ID of the slot as defined when the machine was registered (see {@link UiItemSlotElement}).
 * @returns The {@link MachineItemStack}.
 */
export function getMachineSlotItem(
  loc: DimensionLocation,
  slotId: number,
): MachineItemStack | undefined {
  const participantId = getBlockUniqueId(loc);

  const itemType = getScore(
    getItemTypeScoreboardObjective(slotId),
    participantId,
  );
  if (itemType === undefined) {
    return;
  }

  const itemCount = getScore(
    getItemCountScoreboardObjective(slotId),
    participantId,
  );
  if (!itemCount) {
    return;
  }

  return {
    typeIndex: itemType,
    count: itemCount,
  };
}

/**
 * Sets an item in a machine inventory.
 * @beta
 * @param loc The location of the machine.
 * @param slotId The number ID of the slot as defined when the machine was registered (see {@link UiItemSlotElement}).
 * @param newItemStack The {@link MachineItemStack} to put in the slot. Pass `undefined` to remove the item in the slot.
 */
export function setMachineSlotItem(
  loc: DimensionLocation,
  slotId: number,
  newItemStack?: MachineItemStack,
): void {
  ipcSend("fluffyalien_energisticscore:ipc.setMachineSlot", {
    loc: makeSerializableDimensionLocation(loc),
    slot: slotId,
    item: newItemStack,
  });
}
