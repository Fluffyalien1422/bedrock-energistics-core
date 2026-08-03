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
import { showItemSlotChange } from "./ui";
import {
  MachineItemStack,
  MachineSlotItemExpectOptions,
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

/** Whether the caller asked for any condition at all. */
function hasSlotItemConditions(expect: MachineSlotItemExpectOptions): boolean {
  return (
    expect.expectType !== undefined ||
    expect.expectAmount !== undefined ||
    expect.expectMinAmount !== undefined ||
    expect.expectMaxAmount !== undefined
  );
}

/**
 * Whether a machine item slot's current contents meet the conditions a caller
 * asked for. A condition that wasn't given isn't checked; every condition that
 * applies has to hold.
 */
function machineSlotItemMatches(
  current: MachineItemStack | undefined,
  expect: MachineSlotItemExpectOptions,
): boolean {
  if (
    expect.expectType !== undefined &&
    current?.typeId !== expect.expectType
  ) {
    return false;
  }

  // An empty slot holds nothing, which the amount conditions read as zero.
  const amount = current?.amount ?? 0;

  // An exact amount wins over the bounds. Against an exact amount a bound can
  // only ever be redundant or contradictory.
  if (expect.expectAmount !== undefined) {
    return amount === expect.expectAmount;
  }

  if (expect.expectMinAmount !== undefined && amount < expect.expectMinAmount) {
    return false;
  }

  return (
    expect.expectMaxAmount === undefined || amount <= expect.expectMaxAmount
  );
}

/**
 * Rejects an item count that can't describe a real stack.
 * @remarks
 * A `MachineItemStack` rejects one of these too, but only once the count has
 * been folded into what's left in the slot - so the error would name a number
 * the caller never passed. Checking the argument up front reports the number
 * they actually gave.
 * @throws Throws if `amount` is not a positive integer.
 */
function validateSlotItemAmount(amount: number, failureMsg: string): void {
  if (amount <= 0 || !Number.isInteger(amount)) {
    raisePublic(
      PublicErrorType.InvalidArgument,
      `${failureMsg} Got ${amount.toString()}.`,
    );
  }
}

/**
 * The largest stack the given item type can form.
 * @throws Throws if the item type does not exist.
 */
function getItemMaxAmount(typeId: string, failureMsg: string): number {
  try {
    return new ItemStack(typeId).maxAmount;
  } catch (e) {
    raisePublic(
      PublicErrorType.InvalidArgument,
      `${failureMsg} The item '${typeId}' could not be created: ${String(e)}.`,
    );
  }
}

/** Options for {@link setMachineSlotItem}. */
export interface SetMachineSlotItemOptions {
  /**
   * Whether to show the new contents in the machine's open UI, if it has one.
   * Callers syncing *from* the container back to the block - where the new
   * contents came from the container in the first place - pass `false` to avoid
   * a redundant round-trip.
   * @default true
   */
  showInUi?: boolean;
  /**
   * Conditions the slot must currently meet for the write to apply. Omit, or
   * pass no conditions, to write unconditionally.
   */
  expect?: MachineSlotItemExpectOptions;
}

/**
 * @returns Whether the item was written. Only `false` if `options.expect` was
 * given and the slot didn't meet it.
 */
export function setMachineSlotItem(
  block: Block,
  slotId: string,
  newItemStack?: MachineItemStack,
  options: SetMachineSlotItemOptions = {},
): boolean {
  const registered = InternalRegisteredMachine.forceGetInternal(block.typeId);

  const element = registered.uiElements?.get(slotId);
  if (element?.type !== "itemSlot") {
    raisePublic(
      PublicErrorType.InvalidArgument,
      `Failed to set machine slot item. The element '${slotId}' for machine '${block.typeId}' is of type '${element?.type ?? "undefined"}', expected 'itemSlot'.`,
    );
  }

  if (newItemStack) {
    if (
      element.allowedItems &&
      !element.allowedItems.includes(newItemStack.typeId)
    ) {
      raisePublic(
        PublicErrorType.InvalidArgument,
        `Failed to set machine slot item. The item '${newItemStack.typeId}' is not allowed in slot '${slotId}' of machine '${block.typeId}'.`,
      );
    }

    // An item slot is one container slot, so it cannot show more than a single
    // stack. Storing more would be lost the moment the slot was rendered.
    const maxAmount = getItemMaxAmount(
      newItemStack.typeId,
      "Failed to set machine slot item.",
    );
    if (newItemStack.amount > maxAmount) {
      raisePublic(
        PublicErrorType.InvalidArgument,
        `Failed to set machine slot item. The amount ${newItemStack.amount.toString()} exceeds the maximum stack size of ${maxAmount.toString()} for the item '${newItemStack.typeId}'.`,
      );
    }
  }

  // Checked after the argument validation above, so that a bad argument is
  // reported as such rather than being masked by a compare that would also have
  // failed.
  //
  // Reading the slot is skipped unless there is actually a condition to check,
  // and not just an empty options object. Deserializing raises on data it can't
  // parse, so an unconditional write has to stay able to overwrite a slot whose
  // contents are corrupt - that is how one would be recovered.
  const expect = options.expect;
  if (
    expect &&
    hasSlotItemConditions(expect) &&
    !machineSlotItemMatches(getMachineSlotItemUnsafe(block, slotId), expect)
  ) {
    return false;
  }

  const propertyId = `item${slotId}`;

  // No stack clears the slot's dynamic property entirely. A stack always holds
  // at least one item (see MachineItemStack.amount), so that is the only way to
  // express an empty slot.
  if (newItemStack) {
    setBlockDynamicProperty(
      block,
      propertyId,
      serializeMachineItemStack(newItemStack),
    );
  } else {
    setBlockDynamicProperty(block, propertyId);
  }

  // Shown in the open UI as part of the write, so that the player never acts on
  // an amount the machine has already changed. Callers syncing *from* the
  // container back to the block pass `false`, since the container is where the
  // new contents came from.
  if (options.showInUi ?? true) {
    showItemSlotChange(block, slotId);
  }

  return true;
}

/**
 * Removes items from a machine item slot and returns what was removed.
 * @param amount How many to remove. Defaults to the whole stack. Removing more
 * than the slot holds is not an error; the rest of the stack is returned.
 * @param expect Conditions the slot must currently meet.
 * @returns What was removed, or `undefined` if the slot was empty or did not
 * meet `expect`.
 * @throws Throws if `amount` is not a positive integer.
 * @throws Throws if the element is not an item slot.
 */
export function takeMachineSlotItem(
  block: Block,
  slotId: string,
  amount?: number,
  expect: MachineSlotItemExpectOptions = {},
): MachineItemStack | undefined {
  if (amount !== undefined) {
    validateSlotItemAmount(
      amount,
      "Failed to take machine slot item. Expected 'amount' to be a positive integer.",
    );
  }

  const current = getMachineSlotItem(block, slotId);
  if (!current || !machineSlotItemMatches(current, expect)) {
    return;
  }

  const taken = Math.min(amount ?? current.amount, current.amount);
  const remaining = current.amount - taken;

  setMachineSlotItem(
    block,
    slotId,
    remaining > 0 ? current.withAmount(remaining) : undefined,
  );

  return current.withAmount(taken);
}

/**
 * Adds items to a machine item slot, stacking onto whatever is already there.
 * @param expect Conditions the slot must currently meet.
 * @returns How many were added, which is fewer than `newItemStack.amount` if
 * the slot could not fit them all, and `0` if nothing was added.
 * @throws Throws if the item type does not exist.
 * @throws Throws if the element is not an item slot, or the item is not allowed
 * in it.
 */
export function addMachineSlotItem(
  block: Block,
  slotId: string,
  newItemStack: MachineItemStack,
  expect: MachineSlotItemExpectOptions = {},
): number {
  const current = getMachineSlotItem(block, slotId);

  if (!machineSlotItemMatches(current, expect)) {
    return 0;
  }

  // Only a stack of the same item can be added to; anything else would have to
  // replace what's there, which is a set rather than an add.
  if (current && !current.isSimilarTo(newItemStack)) {
    return 0;
  }

  const maxAmount = getItemMaxAmount(
    newItemStack.typeId,
    "Failed to add machine slot item.",
  );
  const added = Math.min(
    newItemStack.amount,
    maxAmount - (current?.amount ?? 0),
  );
  if (added <= 0) {
    return 0;
  }

  setMachineSlotItem(
    block,
    slotId,
    newItemStack.withAmount((current?.amount ?? 0) + added),
  );

  return added;
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
