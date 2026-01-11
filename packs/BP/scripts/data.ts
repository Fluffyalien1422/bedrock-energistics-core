import { Block, DimensionLocation, ItemStack, world } from "@minecraft/server";
import { machineChangedItemSlots } from "./ui";
import { MachineItemStack, getMachineStorage } from "@/public_api/src";
import {
  getBlockUniqueId,
  getStorageScoreboardObjective,
} from "@/public_api/src/machine_data_internal";
import { logWarn, raise } from "./utils/log";
import { InternalRegisteredMachine } from "./machine_registry";
import {
  getBlockDynamicProperty,
  setBlockDynamicProperty,
} from "./utils/dynamic_property";
import {
  deserializeMachineItemStack,
  serializeMachineItemStack,
} from "@/public_api/src/serialize_machine_item_stack";

export { getBlockUniqueId, getMachineStorage };

export function removeBlockFromScoreboards(loc: DimensionLocation): void {
  const participantId = getBlockUniqueId(loc);

  for (const objective of world.scoreboard.getObjectives()) {
    objective.removeParticipant(participantId);
  }
}

/**
 * Sets the storage of a specific type in a machine.
 * @param block The machine block.
 * @param type The type of storage to set.
 * @param value The new value. Must be an integer.
 * @param callOnStorageSet Whether to call the `onStorageSet` event on the machine, if applicable.
 * @throws Throws if the storage type does not exist.
 * @throws Throws if the new value isn't a non-negative integer.
 * @throws Throws if the block is not valid.
 * @throws Throws if the block is not registered as a machine.
 */
export function setMachineStorage(
  block: Block,
  type: string,
  value: number,
  callOnStorageSet = true,
): void {
  // There is a similar function to this in the public API.
  // Make sure changes are reflected in both.

  if (!block.isValid) {
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

  const registered = InternalRegisteredMachine.forceGetInternal(block.typeId);

  objective.setScore(getBlockUniqueId(block), value);

  if (callOnStorageSet && registered.hasCallback("onStorageSet")) {
    registered.callOnStorageSetEvent(block, type, value);
  }
}

export function getMachineSlotItemRaw(
  loc: DimensionLocation,
  slotId: string,
): string | undefined {
  return getBlockDynamicProperty(loc, `item${slotId}`) as string | undefined;
}

export function getMachineSlotItemUnsafe(
  loc: DimensionLocation,
  slotId: string,
): MachineItemStack | undefined {
  const data = getMachineSlotItemRaw(loc, slotId);
  if (data === undefined) {
    return;
  }

  return deserializeMachineItemStack(data);
}

export function getMachineSlotItem(
  block: Block,
  slotId: string,
): MachineItemStack | undefined {
  const registered = InternalRegisteredMachine.forceGetInternal(block.typeId);
  const element = registered.uiElements?.get(slotId);
  if (element?.type !== "itemSlot") {
    raise(
      `Failed to get machine slot item. The element '${slotId}' for machine '${block.typeId}' is of type '${element?.type ?? "undefined"}', expected 'itemSlot'.`,
    );
  }

  return getMachineSlotItemUnsafe(block, slotId);
}

export function setMachineSlotItem(
  block: Block,
  slotId: string,
  newItemStack?: MachineItemStack,
  setChanged = true,
): void {
  const registered = InternalRegisteredMachine.forceGetInternal(block.typeId);

  const element = registered.uiElements?.get(slotId);
  if (element?.type !== "itemSlot") {
    raise(
      `Failed to set machine slot item. The element '${slotId}' for machine '${block.typeId}' is of type '${element?.type ?? "undefined"}', expected 'itemSlot'.`,
    );
  }

  if (
    newItemStack &&
    element.allowedItems &&
    !element.allowedItems.includes(newItemStack.typeId)
  ) {
    raise(
      `Failed to set machine slot item. The item '${newItemStack.typeId}' is not allowed in slot '${slotId}' of machine '${block.typeId}'.`,
    );
  }

  const uid = getBlockUniqueId(block);
  const propertyId = `item${slotId}`;

  if (setChanged) {
    const existingChangedItemSlotsArr = machineChangedItemSlots.get(uid);
    if (existingChangedItemSlotsArr) {
      existingChangedItemSlotsArr.push(slotId);
    } else {
      machineChangedItemSlots.set(uid, [slotId]);
    }
  }

  if (!newItemStack || newItemStack.amount <= 0) {
    setBlockDynamicProperty(block, propertyId);
    return;
  }

  setBlockDynamicProperty(
    block,
    propertyId,
    serializeMachineItemStack(newItemStack),
  );
}

export function optionalMachineItemStackToItemStack(
  machineItem?: MachineItemStack,
  emptyItemId = "fluffyalien_energisticscore:ui_empty_slot",
): ItemStack {
  if (machineItem) return machineItem.toItemStack();

  const defaultEmptyItem = new ItemStack(emptyItemId);
  if (!defaultEmptyItem.hasTag("fluffyalien_energisticscore:ui_item")) {
    logWarn(
      `Failed to create empty UI element '${emptyItemId}', it does not have the 'fluffyalien_energisticscore:ui_item' tag. Falling back to using 'fluffyalien_energisticscore:ui_empty_slot'.`,
    );

    return new ItemStack("fluffyalien_energisticscore:ui_empty_slot");
  }

  return defaultEmptyItem;
}
