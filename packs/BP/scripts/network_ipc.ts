import * as ipc from "mcbe-addon-ipc";
import { deserializeDimensionLocation } from "@/public_api/src/serialize_utils";
import {
  MangledGeneratePayload,
  MangledNetworkGetAllWithPayload,
  MangledNetworkInstanceMethodPayload,
  MangledNetworkIsPartOfNetworkPayload,
  MangledNetworkQueueSendPayload,
  NetworkEstablishPayload,
  NetworkGetWithPayload,
} from "@/public_api/src/network_internal";
import { MachineNetwork } from "./network";
import { getMachineStorage } from "./data";
import { InternalRegisteredStorageType } from "./storage_type_registry";

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
  const data = payload as NetworkEstablishPayload;
  const ioTypeId = data.ioTypeId;
  const location = deserializeDimensionLocation(data.location);

  const block = location.dimension.getBlock(location);
  if (!block) return null;

  const ioType = InternalRegisteredStorageType.forceGetInternal(ioTypeId);

  return MachineNetwork.establish(ioType, block)?.id ?? null;
}

export function networkGetWithHandler(
  payload: ipc.SerializableValue,
): number | null {
  const data = payload as NetworkGetWithPayload;
  const ioTypeId = data.ioTypeId;
  const location = deserializeDimensionLocation(data.location);
  const connectionType = data.connectionType;

  const ioType = InternalRegisteredStorageType.forceGetInternal(ioTypeId);

  return MachineNetwork.getWith(ioType, location, connectionType)?.id ?? null;
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
  const data = payload as NetworkEstablishPayload;
  const ioTypeId = data.ioTypeId;
  const location = deserializeDimensionLocation(data.location);

  const block = location.dimension.getBlock(location);
  if (!block) return null;

  const ioType = InternalRegisteredStorageType.forceGetInternal(ioTypeId);

  return (
    (
      MachineNetwork.getWithBlock(ioType, block) ??
      MachineNetwork.establish(ioType, block)
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

  const block = location.dimension.getBlock(location);
  if (!block) return null;

  const fullAmount = amount + getMachineStorage(location, type);
  if (!fullAmount) return null;

  const storageType = InternalRegisteredStorageType.forceGetInternal(type);

  MachineNetwork.getOrEstablish(storageType, block)?.queueSend(
    block,
    type,
    fullAmount,
  );

  return null;
}
