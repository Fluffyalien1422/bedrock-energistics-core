/**
 * IPC boundary for machine data. Dependent add-ons can't
 * touch this core pack's dynamic properties directly, so these
 * listeners perform the reads/writes on their behalf.
 */

import {
  GetMachineSlotPayload,
  RemoveMachineDataPayload,
  SetMachineSlotPayload,
} from "@/public_api/src/machine_data_internal";
import * as ipc from "mcbe-addon-ipc";
import { PublicErrorType } from "@/public_api/src";
import { getMachineSlotItemRaw, setMachineSlotItem } from "./data";
import {
  deserializeDimensionLocation,
  SerializableDimensionLocation,
} from "@/public_api/src/serialize_utils";
import { deserializeMachineItemStack } from "@/public_api/src/serialize_machine_item_stack";
import { raisePublic } from "./log";
import { destroyMachine, removeMachineData } from "./machine";
import { stringifyDimensionLocation } from "./utils/string";

export function getMachineSlotListener(
  payload: ipc.SerializableValue,
): string | null {
  const data = payload as GetMachineSlotPayload;
  return (
    getMachineSlotItemRaw(deserializeDimensionLocation(data.loc), data.slot) ??
    null
  );
}

export function setMachineSlotListener(payload: ipc.SerializableValue): null {
  const data = payload as SetMachineSlotPayload;
  const loc = deserializeDimensionLocation(data.loc);
  const block = loc.dimension.getBlock(loc);
  if (!block) {
    raisePublic(
      PublicErrorType.NotFound,
      `Failed to set machine slot item. Block not found at ${stringifyDimensionLocation(loc)}.`,
    );
  }

  setMachineSlotItem(
    block,
    data.slot,
    data.item ? deserializeMachineItemStack(data.item) : undefined,
  );

  return null;
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
