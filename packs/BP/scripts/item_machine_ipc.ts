import * as ipc from "mcbe-addon-ipc";
import {
  GetItemMachineStoragePayload,
  ItemMachineFuncPayload,
  SetItemMachineStoragePayload,
} from "@/public_api/src/item_machine_internal";
import { SerializableContainerSlot } from "@/public_api/src/serialize_utils";
import { InternalRegisteredStorageType } from "./storage_type_registry";
import { InternalRegisteredItemMachine } from "./item_machine_registry";
import { IoCapabilitiesData } from "@/public_api/src";

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

  const serializableSlot = SerializableContainerSlot.fromJson(payload.slot);
  const containerSlot = serializableSlot.toContainerSlot();

  const itemMachine = InternalRegisteredItemMachine.forceGetInternal(
    containerSlot.typeId,
  );

  containerSlot.setDynamicProperty(
    `item_machine_storage_${payload.type}`,
    payload.value,
  );

  if (itemMachine.getData().onStorageSetEvent) {
    itemMachine.callOnStorageSetEvent(
      serializableSlot,
      payload.type,
      payload.value,
    );
  }

  return null;
}

export async function getItemMachineIoHandler(
  payloadRaw: ipc.SerializableValue,
): Promise<IoCapabilitiesData> {
  const payload = payloadRaw as ItemMachineFuncPayload;

  const serializableContainerSlot = SerializableContainerSlot.fromJson(
    payload.slot,
  );

  const containerSlot = serializableContainerSlot.toContainerSlot();

  const registeredItemMachine = InternalRegisteredItemMachine.forceGetInternal(
    containerSlot.typeId,
  );

  const registeredItemMachineData = registeredItemMachine.getData();

  const io = registeredItemMachineData.getIoHandler
    ? await registeredItemMachine.invokeGetIoHandler(serializableContainerSlot)
    : {};

  if (
    io.acceptsAny === true ||
    (io.acceptsAny === undefined &&
      registeredItemMachineData.defaultIo?.acceptsAny)
  ) {
    return {
      acceptsAny: true,
      categories: [],
      types: [],
    };
  }

  return {
    acceptsAny: false,
    categories:
      io.categories ?? registeredItemMachineData.defaultIo?.categories ?? [],
    types: io.types ?? registeredItemMachineData.defaultIo?.types ?? [],
  };
}
