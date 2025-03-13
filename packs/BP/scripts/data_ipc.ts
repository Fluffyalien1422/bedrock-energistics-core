import {
  GetMachineSlotPayload,
  SetMachineSlotPayload,
} from "@/public_api/src/machine_data_internal";
import * as ipc from "mcbe-addon-ipc";
import { getMachineSlotItem, setMachineSlotItem } from "./data";
import { deserializeDimensionLocation } from "@/public_api/src/serialize_utils";
import { MachineItemStack } from "@/public_api/src";

export function getMachineSlotListener(
  payload: ipc.SerializableValue,
): MachineItemStack | null {
  const data = payload as GetMachineSlotPayload;
  return (
    getMachineSlotItem(deserializeDimensionLocation(data.loc), data.slot) ??
    null
  );
}

export function setMachineSlotListener(payload: ipc.SerializableValue): null {
  const data = payload as SetMachineSlotPayload;
  setMachineSlotItem(
    deserializeDimensionLocation(data.loc),
    data.slot,
    data.item,
  );
  return null;
}

