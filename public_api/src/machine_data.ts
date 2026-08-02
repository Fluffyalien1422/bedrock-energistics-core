import { Block, DimensionLocation } from "@minecraft/server";
import {
  AddMachineSlotPayload,
  getBlockUniqueId,
  GetMachineSlotPayload,
  getScore,
  getStorageScoreboardObjective,
  MachineSlotExpectPayload,
  resolveMachineStorageWrite,
  SetMachineSlotPayload,
  setScore,
  TakeMachineSlotPayload,
} from "./machine_data_internal.js";
import { makeSerializableDimensionLocation } from "./serialize_utils.js";
import { ipcInvoke } from "./ipc_wrapper.js";
import { BecIpcListener } from "./bec_ipc_listener.js";
import { logWarn, raisePublic } from "./log.js";
import { PublicErrorType } from "./error.js";
import { RegisteredMachine } from "./machine_registry.js";
import { callMachineOnStorageSetEvent } from "./machine_registry_internal.js";
import { MachineItemStack } from "./machine_item_stack.js";
import {
  deserializeMachineItemStack,
  serializeMachineItemStack,
} from "./serialize_machine_item_stack.js";

/**
 * Gets the storage of a specific type in a machine.
 * @beta
 * @param loc The location of the machine.
 * @param type The storage type ID.
 * @throws Throws a {@link PublicError} of type {@link PublicErrorType.NotRegistered} if the storage type does not exist.
 */
export function getMachineStorage(
  loc: DimensionLocation,
  type: string,
): number {
  const objective = getStorageScoreboardObjective(type);

  if (!objective) {
    raisePublic(
      PublicErrorType.NotRegistered,
      `Failed to get machine storage. Storage type '${type}' doesn't exist.`,
    );
  }

  return getScore(objective, getBlockUniqueId(loc)) ?? 0;
}

/**
 * Sets the storage of a specific type in a machine.
 * @beta
 * @param block The machine block.
 * @param type The storage type ID.
 * @param value The new value. Must be a non-negative integer.
 * @param callOnStorageSet Whether to call the `onStorageSet` event on the machine, if applicable.
 * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidObject} if the block is not valid.
 * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidArgument} if the new value is negative.
 * @throws Throws a {@link PublicError} of type {@link PublicErrorType.NotRegistered} if the storage type does not exist, or if the block is not registered as a machine.
 * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidState} if this package has not been initialized (see {@link init}).
 */
export async function setMachineStorage(
  block: Block,
  type: string,
  value: number,
  callOnStorageSet = true,
): Promise<void> {
  // There is a similar function to this in the add-on.
  // Make sure changes are reflected in both. The validation they share lives in
  // `resolveMachineStorageWrite`.

  // To avoid unnecessary IPC calls, this function calls the 'onStorageSet'
  // event on machines directly, without routing through Bedrock Energistics Core.
  // This also allows the local machine registry cache to be used, avoiding any
  // IPC calls for machines that don't have the 'onStorageSet' event.

  const objective = resolveMachineStorageWrite(block, type, value);

  const registered = await RegisteredMachine.forceGet(block.typeId);

  if (!setScore(objective, getBlockUniqueId(block), value)) {
    logWarn("Failed to set machine storage: Failed to set objective score.");
    return;
  }

  if (callOnStorageSet && registered.hasCallback("onStorageSet")) {
    callMachineOnStorageSetEvent(registered, block, type, value);
  }
}

/**
 * Gets an item from a machine inventory.
 * @beta
 * @param loc The location of the machine.
 * @param elementId The ID of the item slot element.
 * @returns The {@link MachineItemStack} or `undefined` if there is no item in the specified slot.
 * @throws Throws a {@link PublicError} of type {@link PublicErrorType.NotFound} if there is no block at the given location, including when that location's chunk is not loaded.
 * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidState} if this package has not been initialized (see {@link init}).
 */
export async function getMachineSlotItem(
  loc: DimensionLocation,
  elementId: string,
): Promise<MachineItemStack | undefined> {
  const payload: GetMachineSlotPayload = {
    loc: makeSerializableDimensionLocation(loc),
    slot: elementId,
  };

  const data = await ipcInvoke<string | null>(
    BecIpcListener.GetMachineSlot,
    payload,
  );

  return data ? deserializeMachineItemStack(data) : undefined;
}

/**
 * Conditions that a machine item slot must currently meet for an operation to
 * apply. Each is only checked if given, and every condition that applies must
 * hold; an empty object applies unconditionally.
 * @beta
 * @remarks
 * Use these to make a read-modify-write safe when the operations that do it for
 * you don't fit. Anything you read from a slot may already be out of date by the
 * time your write reaches Bedrock Energistics Core - the player has had ticks in
 * which to change it - so state what you expected to be there and handle the
 * operation reporting that it didn't apply.
 */
export interface MachineSlotItemExpectOptions {
  /**
   * The item type the slot must hold.
   * @beta
   */
  expectType?: string;
  /**
   * Exactly how many items the slot must hold. Use `0` to require an empty
   * slot.
   * @beta
   * @remarks
   * Takes precedence over {@link MachineSlotItemExpectOptions.expectMinAmount}
   * and {@link MachineSlotItemExpectOptions.expectMaxAmount}, which are not
   * checked at all when this is given.
   */
  expectAmount?: number;
  /**
   * The fewest items the slot may hold. Ignored if
   * {@link MachineSlotItemExpectOptions.expectAmount} is given.
   * @beta
   * @remarks
   * Passing the same number as {@link takeMachineSlotItem}'s `amount` consumes
   * that many items or none at all, since the take only applies when the slot
   * can cover it in full.
   */
  expectMinAmount?: number;
  /**
   * The most items the slot may hold. Ignored if
   * {@link MachineSlotItemExpectOptions.expectAmount} is given.
   * @beta
   */
  expectMaxAmount?: number;
}

/**
 * Maps the conditions an add-on gave onto the fields sent over IPC. Kept in one
 * place so that the three operations taking them can't drift apart.
 */
function makeExpectPayload(
  options?: MachineSlotItemExpectOptions,
): MachineSlotExpectPayload {
  return {
    expectType: options?.expectType,
    expectAmount: options?.expectAmount,
    expectMinAmount: options?.expectMinAmount,
    expectMaxAmount: options?.expectMaxAmount,
  };
}

/**
 * Removes items from a machine item slot.
 * @beta
 * @remarks
 * Prefer this over reading a slot and writing it back: the whole
 * read-modify-write happens inside Bedrock Energistics Core, so a player can't
 * take the item out in between and end up holding a copy of it.
 * @param loc The location of the machine.
 * @param elementId The ID of the item slot element.
 * @param amount The amount of items to remove. Defaults to the whole stack. Asking
 * for more than the slot holds is not an error; the rest of the stack is
 * returned. To take this many items or none at all, pass the same number as
 * {@link MachineSlotItemExpectOptions.expectMinAmount}.
 * @param options Conditions the slot must meet.
 * @returns What was removed, or `undefined` if the slot was empty or did not
 * meet `options`.
 * @throws Throws a {@link PublicError} of type {@link PublicErrorType.NotFound} if there is no block at the given location, including when that location's chunk is not loaded.
 * @throws Throws a {@link PublicError} of type {@link PublicErrorType.NotRegistered} if the block is not registered as a machine.
 * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidArgument} if the element is not an item slot, or if `amount` is not a positive integer.
 * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidState} if this package has not been initialized (see {@link init}).
 */
export async function takeMachineSlotItem(
  loc: DimensionLocation,
  elementId: string,
  amount?: number,
  options?: MachineSlotItemExpectOptions,
): Promise<MachineItemStack | undefined> {
  const payload: TakeMachineSlotPayload = {
    loc: makeSerializableDimensionLocation(loc),
    slot: elementId,
    amount,
    ...makeExpectPayload(options),
  };

  const data = await ipcInvoke<string | null>(
    BecIpcListener.TakeMachineSlot,
    payload,
  );

  return data ? deserializeMachineItemStack(data) : undefined;
}

/**
 * Adds items to a machine item slot, stacking onto whatever is already there.
 * @beta
 * @remarks
 * Prefer this over reading a slot and writing it back: the whole
 * read-modify-write happens inside Bedrock Energistics Core, so a change the
 * player makes in between can't be overwritten.
 * @param loc The location of the machine.
 * @param elementId The ID of the item slot element.
 * @param newItemStack The {@link MachineItemStack} to add. Its `amount` is how
 * many to add.
 * @param options Conditions the slot must meet.
 * @returns The amount of items added. Fewer than `newItemStack.amount` if the
 * slot couldn't fit them all, and `0` if nothing was added - because the slot
 * is full, holds a different item, or doesn't meet `options`.
 * @throws Throws a {@link PublicError} of type {@link PublicErrorType.NotFound} if there is no block at the given location, including when that location's chunk is not loaded.
 * @throws Throws a {@link PublicError} of type {@link PublicErrorType.NotRegistered} if the block is not registered as a machine.
 * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidArgument} if the element is not an item slot, if the item is not allowed in that slot, or if the item does not exist.
 * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidState} if this package has not been initialized (see {@link init}).
 */
export async function addMachineSlotItem(
  loc: DimensionLocation,
  elementId: string,
  newItemStack: MachineItemStack,
  options?: MachineSlotItemExpectOptions,
): Promise<number> {
  const payload: AddMachineSlotPayload = {
    loc: makeSerializableDimensionLocation(loc),
    slot: elementId,
    item: serializeMachineItemStack(newItemStack),
    ...makeExpectPayload(options),
  };

  return ipcInvoke<number>(BecIpcListener.AddMachineSlot, payload);
}

/**
 * Sets an item in a machine inventory.
 * @beta
 * @remarks
 * Without conditions in `options`, this replaces whatever is in the slot,
 * including a change the player made since you last looked at it - which can
 * duplicate an item they are already holding. For anything derived from the
 * slot's current contents, prefer {@link takeMachineSlotItem} or
 * {@link addMachineSlotItem}, or state what you expected to replace.
 * @param loc The location of the machine.
 * @param elementId The ID of the item slot element.
 * @param newItemStack The {@link MachineItemStack} to put in the slot. Pass `undefined` to remove the item in the slot.
 * @param options Conditions the slot must meet.
 * @returns Whether the item was set. Only `false` if `options` gave a condition
 * the slot didn't meet, so a write with no conditions always resolves `true`.
 * @throws Throws a {@link PublicError} of type {@link PublicErrorType.NotFound} if there is no block at the given location, including when that location's chunk is not loaded.
 * @throws Throws a {@link PublicError} of type {@link PublicErrorType.NotRegistered} if the block is not registered as a machine.
 * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidArgument} if the element is not an item slot, if the item is not allowed in that slot, if the item does not exist, or if its amount exceeds the item's maximum stack size.
 * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidState} if this package has not been initialized (see {@link init}).
 */
export async function setMachineSlotItem(
  loc: DimensionLocation,
  elementId: string,
  newItemStack?: MachineItemStack,
  options?: MachineSlotItemExpectOptions,
): Promise<boolean> {
  const payload: SetMachineSlotPayload = {
    loc: makeSerializableDimensionLocation(loc),
    slot: elementId,
    item: newItemStack ? serializeMachineItemStack(newItemStack) : undefined,
    ...makeExpectPayload(options),
  };

  return ipcInvoke<boolean>(BecIpcListener.SetMachineSlot, payload);
}
