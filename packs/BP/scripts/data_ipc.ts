/**
 * IPC boundary for machine data. Dependent add-ons can't
 * touch this core pack's dynamic properties directly, so these
 * listeners perform the reads/writes on their behalf.
 */

import {
  AddMachineSlotPayload,
  GetMachineSlotPayload,
  RemoveMachineDataPayload,
  SetMachineSlotPayload,
  TakeMachineSlotPayload,
} from "@/public_api/src/machine_data_internal";
import * as ipc from "mcbe-addon-ipc";
import { Block, DimensionLocation } from "@minecraft/server";
import { PublicErrorType } from "@/public_api/src";
import {
  addMachineSlotItem,
  getMachineSlotItemRaw,
  setMachineSlotItem,
  takeMachineSlotItem,
} from "./data";
import {
  deserializeDimensionLocation,
  SerializableDimensionLocation,
} from "@/public_api/src/serialize_utils";
import {
  deserializeMachineItemStack,
  serializeMachineItemStack,
} from "@/public_api/src/serialize_machine_item_stack";
import { raisePublic } from "./log";
import { destroyMachine, removeMachineData } from "./machine";
import { flushItemSlotsFromContainer } from "./ui/item_slots";
import { stringifyDimensionLocation } from "./utils/string";

/**
 * Resolves the block an item slot call refers to, and brings its stored items
 * up to date with its open UI container.
 * @remarks
 * Flushing first means an add-on never reads or overwrites item slot contents
 * the player has already changed. One side effect: reclaiming a disallowed item
 * the player dropped into a slot can now happen on whichever tick an add-on
 * calls in, rather than only on a UI update tick.
 *
 * A read only touches dynamic properties, so it doesn't strictly need the
 * block - but a machine's data is cleared when its block is destroyed, so data
 * without a block means either an unloaded chunk or an add-on that removed the
 * block without calling `destroyMachine` or `removeMachineData`. Neither is a
 * call that can be answered correctly, so reads fail here just like writes.
 * @throws Throws if there is no block at the location.
 */
function resolveItemSlotBlock(
  loc: DimensionLocation,
  failureMsg: string,
): Block {
  const block = loc.dimension.getBlock(loc);
  if (!block) {
    raisePublic(
      PublicErrorType.NotFound,
      `${failureMsg} Block not found at ${stringifyDimensionLocation(loc)}.`,
    );
  }

  flushItemSlotsFromContainer(block);

  return block;
}

export function getMachineSlotListener(
  payload: ipc.SerializableValue,
): string | null {
  const data = payload as GetMachineSlotPayload;

  const block = resolveItemSlotBlock(
    deserializeDimensionLocation(data.loc),
    "Failed to get machine slot item.",
  );

  return getMachineSlotItemRaw(block, data.slot) ?? null;
}

export function setMachineSlotListener(
  payload: ipc.SerializableValue,
): boolean {
  const data = payload as SetMachineSlotPayload;

  const block = resolveItemSlotBlock(
    deserializeDimensionLocation(data.loc),
    "Failed to set machine slot item.",
  );

  return setMachineSlotItem(
    block,
    data.slot,
    data.item ? deserializeMachineItemStack(data.item) : undefined,
    { expect: data },
  );
}

export function takeMachineSlotListener(
  payload: ipc.SerializableValue,
): string | null {
  const data = payload as TakeMachineSlotPayload;

  const block = resolveItemSlotBlock(
    deserializeDimensionLocation(data.loc),
    "Failed to take machine slot item.",
  );

  const taken = takeMachineSlotItem(block, data.slot, data.amount, data);

  return taken ? serializeMachineItemStack(taken) : null;
}

export function addMachineSlotListener(payload: ipc.SerializableValue): number {
  const data = payload as AddMachineSlotPayload;

  const block = resolveItemSlotBlock(
    deserializeDimensionLocation(data.loc),
    "Failed to add machine slot item.",
  );

  return addMachineSlotItem(
    block,
    data.slot,
    deserializeMachineItemStack(data.item),
    data,
  );
}

export function removeMachineDataListener(
  payload: ipc.SerializableValue,
): null {
  const data = payload as RemoveMachineDataPayload;
  const loc = deserializeDimensionLocation(data.loc);
  const connectionType = data.connectionType;
  removeMachineData(loc, connectionType);
  return null;
}

export function destroyMachineListener(payload: ipc.SerializableValue): null {
  const data = payload as SerializableDimensionLocation;

  const loc = deserializeDimensionLocation(data);
  const block = loc.dimension.getBlock(loc);
  if (!block) {
    raisePublic(
      PublicErrorType.NotFound,
      `Failed to destroy machine. Expected a block at ${stringifyDimensionLocation(loc)}.`,
    );
  }

  destroyMachine(block);

  return null;
}
