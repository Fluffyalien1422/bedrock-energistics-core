import {
  GetMachineSlotPayload,
  RemoveMachineDataPayload,
  SetMachineSlotPayload,
} from "@/public_api/src/machine_data_internal";
import * as ipc from "mcbe-addon-ipc";
import { getMachineSlotItemRaw, setMachineSlotItem } from "./data";
import {
  deserializeDimensionLocation,
  SerializableDimensionLocation,
} from "@/public_api/src/serialize_utils";
import { deserializeMachineItemStack } from "@/public_api/src/serialize_machine_item_stack";
import { raise } from "./utils/log";
import { Vector3Utils } from "@minecraft/math";
import { destroyMachine, removeMachineData } from "./machine";

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
    raise(
      `Failed to set machine slot item. Block not found at ${Vector3Utils.toString(loc)} in '${loc.dimension.id}'.`,
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
    raise(
      `Expected a block at (${Vector3Utils.toString(loc)}) in '${loc.dimension.id}'.`,
    );
  }

  destroyMachine(block);

  return null;
}
