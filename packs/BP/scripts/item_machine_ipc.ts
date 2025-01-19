import * as ipc from "mcbe-addon-ipc";
import {
  GetItemMachineStoragePayload,
  SetItemMachineStoragePayload,
} from "@/public_api/src/item_machine_internal";
import { SerializableContainerSlot } from "@/public_api/src/serialize_utils";
import { InternalRegisteredStorageType } from "./storage_type_registry";

export function getItemMachineStorageHandler(
  payloadRaw: ipc.SerializableValue,
): number {
  const payload = payloadRaw as GetItemMachineStoragePayload;

  // ensure the storage type exists
  InternalRegisteredStorageType.forceGetInternal(payload.type);

  const containerSlot = SerializableContainerSlot.fromJson(
    payload.slot,
  ).toContainerSlot();

  return (
    (containerSlot.getDynamicProperty(
      `item_machine_storage_${payload.type}`,
    ) as number | undefined) ?? 0
  );
}

export function setItemMachineStorageListener(
  payloadRaw: ipc.SerializableValue,
): null {
  const payload = payloadRaw as SetItemMachineStoragePayload;

  // ensure the storage type exists
  InternalRegisteredStorageType.forceGetInternal(payload.type);

  const containerSlot = SerializableContainerSlot.fromJson(
    payload.slot,
  ).toContainerSlot();

  containerSlot.setDynamicProperty(
    `item_machine_storage_${payload.type}`,
    payload.value,
  );

  return null;
}
