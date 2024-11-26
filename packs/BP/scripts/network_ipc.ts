import * as ipc from "mcbe-addon-ipc";
import { deserializeDimensionLocation } from "@/public_api/src/serialize_utils";
import {
  MangledGeneratePayload,
  MangledNetworkEstablishPayload,
  MangledNetworkGetAllWithPayload,
  MangledNetworkGetWithPayload,
  MangledNetworkInstanceMethodPayload,
  MangledNetworkIsPartOfNetworkPayload,
  MangledNetworkQueueSendPayload,
} from "@/public_api/src/network_internal";
import { MachineNetwork } from "./network";
import { getMachineStorage, setMachineStorage } from "./data";
import { InternalRegisteredStorageType } from "./storage_type_registry";
import { GenerateMode } from "@/public_api/src";

export function networkDestroyListener(payload: ipc.SerializableValue): null {
  const data = payload as MangledNetworkInstanceMethodPayload;
  const networkId = data.a;
  MachineNetwork.getFromId(networkId)?.destroy();
  return null;
}

export function networkQueueSendListener(payload: ipc.SerializableValue): null {
  const data = payload as MangledNetworkQueueSendPayload;
  const networkId = data.a;
  const location = deserializeDimensionLocation(data.b);
  const type = data.c;
  const amount = data.d;

  const block = location.dimension.getBlock(location);
  if (!block) return null;

  MachineNetwork.getFromId(networkId)?.queueSend(block, type, amount);

  return null;
}

export function networkEstablishHandler(
  payload: ipc.SerializableValue,
): number | null {
  const data = payload as MangledNetworkEstablishPayload;
  const category = data.a;
  const blockLocation = deserializeDimensionLocation(data.b);

  const block = blockLocation.dimension.getBlock(blockLocation);
  if (!block) return null;

  return MachineNetwork.establish(category, block)?.id ?? null;
}

export function networkGetWithHandler(
  payload: ipc.SerializableValue,
): number | null {
  const data = payload as MangledNetworkGetWithPayload;
  const category = data.a;
  const location = deserializeDimensionLocation(data.b);
  const type = data.c;

  return MachineNetwork.getWith(category, location, type)?.id ?? null;
}

export function networkGetAllWithHandler(
  payload: ipc.SerializableValue,
): number[] {
  const data = payload as MangledNetworkGetAllWithPayload;
  const location = deserializeDimensionLocation(data.a);
  const type = data.b;

  return MachineNetwork.getAllWith(location, type).map((network) => network.id);
}

export function networkGetOrEstablishHandler(
  payload: ipc.SerializableValue,
): number | null {
  const data = payload as MangledNetworkEstablishPayload;
  const category = data.a;
  const blockLocation = deserializeDimensionLocation(data.b);

  const block = blockLocation.dimension.getBlock(blockLocation);
  if (!block) return null;

  return (
    (
      MachineNetwork.getWithBlock(category, block) ??
      MachineNetwork.establish(category, block)
    )?.id ?? null
  );
}

export function networkIsPartOfNetworkHandler(
  payload: ipc.SerializableValue,
): boolean {
  const data = payload as MangledNetworkIsPartOfNetworkPayload;
  const networkId = data.a;
  const location = deserializeDimensionLocation(data.b);
  const type = data.c;

  return (
    MachineNetwork.getFromId(networkId)?.isPartOfNetwork(location, type) ??
    false
  );
}

export function generateListener(payload: ipc.SerializableValue): null {
  const data = payload as MangledGeneratePayload;
  const location = deserializeDimensionLocation(data.a);
  const type = data.b;
  const amount = data.c;
  const mode = data.d;

  const block = location.dimension.getBlock(location);
  if (!block) return null;

  const reserve = getMachineStorage(block, type);
  let amountToSend = 0;

  switch (mode) {
    case GenerateMode.Default: {
      setMachineStorage(block, type, 0);
      amountToSend = reserve + amount;
      break;
    }
    case GenerateMode.TakeFromReserve: {
      amountToSend = Math.min(amount, reserve);
      setMachineStorage(block, type, reserve - amountToSend);
      break;
    }
  }

  const storageType = InternalRegisteredStorageType.forceGetInternal(type);
  MachineNetwork.getOrEstablish(storageType.category, block)?.queueSend(
    block,
    type,
    amountToSend,
  );

  return null;
}
