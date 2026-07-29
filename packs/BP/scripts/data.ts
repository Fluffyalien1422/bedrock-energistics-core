/**
 * How machine data is stored:
 * - Storage amounts (energy, etc.) live on scoreboards, one objective per
 *   storage type, with each machine block as a participant keyed by its unique
 *   location id (see getBlockUniqueId). This is what getMachineStorage /
 *   setMachineStorage read and write.
 * - Item-slot contents live in world dynamic properties keyed per block+slot
 *   (see the `item<slotId>` properties below and utils/dynamic_property.ts).
 */

import { Block, DimensionLocation, ItemStack, world } from "@minecraft/server";
import { machineChangedItemSlots } from "./ui";
import {
  MachineItemStack,
  getMachineStorage,
  PublicErrorType,
} from "@/public_api/src";
import {
  getBlockUniqueId,
  resolveMachineStorageWrite,
  setScore,
} from "@/public_api/src/machine_data_internal";
import { logWarn, raisePublic } from "./log";
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

/**
 * Removes a machine location's score from every storage objective, clearing all
 * of its stored amounts. Called when a machine's data is torn down.
 */
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
  // Make sure changes are reflected in both. The validation they share lives in
  // `resolveMachineStorageWrite`.

  const objective = resolveMachineStorageWrite(block, type, value);

  const registered = InternalRegisteredMachine.forceGetInternal(block.typeId);

  if (!setScore(objective, getBlockUniqueId(block), value)) {
    logWarn("Failed to set machine storage: Failed to set objective score.");
    return;
  }

  if (callOnStorageSet && registered.hasCallback("onStorageSet")) {
    registered.callOnStorageSetEvent(block, type, value);
  }
}

/**
 * Gets the raw (still-serialized) contents of a machine item slot, or
 * `undefined` if the slot is empty. Item slots are stored as serialized strings
 * in block dynamic properties named `item<slotId>`.
 */
export function getMachineSlotItemRaw(
  loc: DimensionLocation,
  slotId: string,
): string | undefined {
  return getBlockDynamicProperty(loc, `item${slotId}`) as string | undefined;
}

/**
 * Deserializes a machine slot item without validating that `slotId` is actually
 * an item-slot UI element. "Unsafe" because it skips that check - prefer
 * {@link getMachineSlotItem} unless the slot is already known to be valid.
 */
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
    raisePublic(
      PublicErrorType.InvalidArgument,
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
    raisePublic(
      PublicErrorType.InvalidArgument,
      `Failed to set machine slot item. The element '${slotId}' for machine '${block.typeId}' is of type '${element?.type ?? "undefined"}', expected 'itemSlot'.`,
    );
  }

  if (
    newItemStack &&
    element.allowedItems &&
    !element.allowedItems.includes(newItemStack.typeId)
  ) {
    raisePublic(
      PublicErrorType.InvalidArgument,
      `Failed to set machine slot item. The item '${newItemStack.typeId}' is not allowed in slot '${slotId}' of machine '${block.typeId}'.`,
    );
  }

  const uid = getBlockUniqueId(block);
  const propertyId = `item${slotId}`;

  // Record that this slot changed so the UI update loop knows to push the new
  // contents into the open container. Callers syncing *from* the container back
  // to the block (i.e. reflecting a change the UI already shows) pass
  // `setChanged = false` to avoid a redundant round-trip.
  if (setChanged) {
    const existingChangedItemSlotsArr = machineChangedItemSlots.get(uid);
    if (existingChangedItemSlotsArr) {
      existingChangedItemSlotsArr.add(slotId);
    } else {
      machineChangedItemSlots.set(uid, new Set([slotId]));
    }
  }

  // An empty/zero-amount stack clears the slot's dynamic property entirely.
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

/**
 * Whether an item is one of the add-on's UI filler items (storage-bar segments,
 * buttons, empty-slot placeholders, etc.). These are tagged so they can be told
 * apart from real items a player places into a machine slot.
 */
export function isUiItem(item: ItemStack): boolean {
  return item.hasTag("fluffyalien_energisticscore:ui_item");
}

/**
 * Converts an optional {@link MachineItemStack} to an `ItemStack`, falling back
 * to an empty-slot placeholder item when there is no stack. Validates that the
 * placeholder is a real UI item, warning and using the default if not.
 */
export function optionalMachineItemStackToItemStack(
  machineItem?: MachineItemStack,
  emptyItemId = "fluffyalien_energisticscore:ui_empty_slot",
): ItemStack {
  if (machineItem) return machineItem.toItemStack();

  const defaultEmptyItem = new ItemStack(emptyItemId);
  if (!isUiItem(defaultEmptyItem)) {
    logWarn(
      `Failed to create empty UI element '${emptyItemId}', it does not have the 'fluffyalien_energisticscore:ui_item' tag. Falling back to using 'fluffyalien_energisticscore:ui_empty_slot'.`,
    );

    return new ItemStack("fluffyalien_energisticscore:ui_empty_slot");
  }

  return defaultEmptyItem;
}
