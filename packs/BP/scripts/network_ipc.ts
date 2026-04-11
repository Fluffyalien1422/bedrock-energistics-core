import * as ipc from "mcbe-addon-ipc";
import { deserializeDimensionLocation } from "@/public_api/src/serialize_utils";
import {
  GeneratePayload,
  NetworkGetAllWithPayload,
  NetworkInstanceMethodPayload,
  NetworkIsPartOfNetworkPayload,
  NetworkQueueSendPayload,
  NetworkEstablishPayload,
  NetworkGetWithPayload,
  NetworkDataPayload,
} from "@/public_api/src/network_internal";
import { MachineNetwork } from "./network";
import { getMachineStorage } from "./data";
import { InternalRegisteredStorageType } from "./storage_type_registry";
import { NetworkStorageTypeData } from "@/public_api/src";

function createNetworkDataPayload(network: MachineNetwork): NetworkDataPayload {
  return {
    id: network.id,
    ioType: {
      id: network.ioType.id,
      category: network.ioType.category,
    },
  };
}

export function networkDestroyListener(payload: ipc.SerializableValue): null {
  const data = payload as NetworkInstanceMethodPayload;
  const networkId = data.networkId;
  MachineNetwork.getFromId(networkId)?.destroy();
  return null;
}

export function networkQueueSendListener(payload: ipc.SerializableValue): null {
  const data = payload as NetworkQueueSendPayload;
  const networkId = data.networkId;
  const location = deserializeDimensionLocation(data.loc);
  const amount = data.amount;

  const block = location.dimension.getBlock(location);
  if (!block) return null;

  MachineNetwork.getFromId(networkId)?.queueSend(block, amount);

  return null;
}

export function networkEstablishHandler(
  payload: ipc.SerializableValue,
): NetworkDataPayload | null {
  const data = payload as NetworkEstablishPayload;
  const ioTypeId = data.ioTypeId;
  const location = deserializeDimensionLocation(data.location);

  const block = location.dimension.getBlock(location);
  if (!block) return null;

  const ioType = InternalRegisteredStorageType.forceGetInternal(ioTypeId);
  const newNetwork = MachineNetwork.establish(ioType, block);
  if (!newNetwork) return null;

  return createNetworkDataPayload(newNetwork);
}

export function networkGetWithHandler(
  payload: ipc.SerializableValue,
): NetworkDataPayload | null {
  const data = payload as NetworkGetWithPayload;
  const ioTypeId = data.ioTypeId;
  const location = deserializeDimensionLocation(data.location);
  const connectionType = data.connectionType;

  const ioType = InternalRegisteredStorageType.forceGetInternal(ioTypeId);
  const newNetwork = MachineNetwork.getWith(ioType, location, connectionType);
  if (!newNetwork) return null;

  return createNetworkDataPayload(newNetwork);
}

export function networkGetAllWithHandler(
  payload: ipc.SerializableValue,
): NetworkDataPayload[] {
  const data = payload as NetworkGetAllWithPayload;
  const location = deserializeDimensionLocation(data.loc);
  const type = data.type;

  return MachineNetwork.getAllWith(location, type).map(
    createNetworkDataPayload,
  );
}

export function networkGetOrEstablishHandler(
  payload: ipc.SerializableValue,
): NetworkDataPayload | null {
  const data = payload as NetworkEstablishPayload;
  const ioTypeId = data.ioTypeId;
  const location = deserializeDimensionLocation(data.location);

  const block = location.dimension.getBlock(location);
  if (!block) return null;

  const ioType = InternalRegisteredStorageType.forceGetInternal(ioTypeId);
  const network =
    MachineNetwork.getWithBlock(ioType, block) ??
    MachineNetwork.establish(ioType, block);
  if (!network) return null;

  return createNetworkDataPayload(network);
}

export function networkIsPartOfNetworkHandler(
  payload: ipc.SerializableValue,
): boolean {
  const data = payload as NetworkIsPartOfNetworkPayload;
  const networkId = data.networkId;
  const location = deserializeDimensionLocation(data.loc);
  const type = data.type;

  return (
    MachineNetwork.getFromId(networkId)?.isPartOfNetwork(location, type) ??
    false
  );
}

export function generateListener(payload: ipc.SerializableValue): null {
  const data = payload as GeneratePayload;
  const location = deserializeDimensionLocation(data.loc);
  const type = data.type;
  const amount = data.amount;

  const block = location.dimension.getBlock(location);
  if (!block) return null;

  const fullAmount = amount + getMachineStorage(location, type);
  if (!fullAmount) return null;

  const storageType = InternalRegisteredStorageType.forceGetInternal(type);

  MachineNetwork.getOrEstablish(storageType, block)?.queueSend(
    block,
    fullAmount,
  );

  return null;
}

export function networkGetStatsHandler(
  payload: ipc.SerializableValue,
): NetworkStorageTypeData | null {
  const data = payload as NetworkInstanceMethodPayload;
  const networkId = data.networkId;
  const network = MachineNetwork.getFromId(networkId);
  return network?.latestNetworkStats ?? null;
}
