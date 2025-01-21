import { MachineItemStack } from "@/public_api/src";
import { setMachineSlotItem } from "./data";
import {
  deserializeDimensionLocation,
  SerializableDimensionLocation,
} from "@/public_api/src/serialize_utils";
import {
  NetworkLinkGetRequest,
  NetworkLinkGetResponse,
  NetworkLinkAddRequest,
  NetworkLinkRemoveRequest,
  NetworkLinkDestroyRequest,
} from "@/public_api/src/network_links/ipc_events";
import { getNetworkLinkNode } from "./network_links/network_link_component";
import {
  generateListener,
  networkDestroyListener,
  networkEstablishHandler,
  networkGetAllWithHandler,
  networkGetOrEstablishHandler,
  networkGetWithHandler,
  networkIsPartOfNetworkHandler,
  networkQueueSendListener,
} from "./network_ipc";
import {
  InternalRegisteredMachine,
  registerMachineListener,
} from "./machine_registry";
import {
  InternalRegisteredStorageType,
  registerStorageTypeListener,
} from "./storage_type_registry";
import { registerListener } from "./ipc_wrapper";
import { BecIpcListener } from "@/public_api/src/bec_ipc_listener";
import {
  InternalRegisteredItemMachine,
  registerItemMachineListener,
} from "./item_machine_registry";
import {
  getItemMachineIoHandler,
  getItemMachineStorageHandler,
  setItemMachineStorageListener,
} from "./item_machine_ipc";

interface SetItemInMachineSlotPayload {
  loc: SerializableDimensionLocation;
  slot: number;
  item?: MachineItemStack;
}

registerListener(BecIpcListener.RegisterMachine, registerMachineListener);
registerListener(
  BecIpcListener.RegisterStorageType,
  registerStorageTypeListener,
);
registerListener(BecIpcListener.SetMachineSlot, (payload_) => {
  const payload = payload_ as SetItemInMachineSlotPayload;
  setMachineSlotItem(
    deserializeDimensionLocation(payload.loc),
    payload.slot,
    payload.item,
  );
  return null;
});
registerListener(BecIpcListener.DestroyNetwork, networkDestroyListener);
registerListener(BecIpcListener.NetworkQueueSend, networkQueueSendListener);
registerListener(BecIpcListener.Generate, generateListener);
registerListener(BecIpcListener.EstablishNetwork, networkEstablishHandler);
registerListener(BecIpcListener.GetNetworkWith, networkGetWithHandler);
registerListener(BecIpcListener.GetAllNetworksWith, networkGetAllWithHandler);
registerListener(
  BecIpcListener.GetOrEstablishNetwork,
  networkGetOrEstablishHandler,
);
registerListener(
  BecIpcListener.RegisterItemMachine,
  registerItemMachineListener,
);
registerListener(BecIpcListener.IsPartOfNetwork, networkIsPartOfNetworkHandler);
registerListener(
  BecIpcListener.GetRegisteredMachine,
  (payload) =>
    InternalRegisteredMachine.getInternal(payload as string)?.getData() ?? null,
);
registerListener(
  BecIpcListener.GetRegisteredStorageType,
  (payload) =>
    InternalRegisteredStorageType.getInternal(
      payload as string,
    )?.getDefinition() ?? null,
);
registerListener(BecIpcListener.GetNetworkLink, (payload) => {
  const data = payload as NetworkLinkGetRequest;
  const link = getNetworkLinkNode(data.self);
  const result: NetworkLinkGetResponse = { locations: link.getConnections() };
  return result;
});
registerListener(BecIpcListener.AddNetworkLink, (payload) => {
  const data = payload as NetworkLinkAddRequest;
  const link = getNetworkLinkNode(data.self);
  link.addConnection(data.other);
  return null;
});
registerListener(BecIpcListener.RemoveNetworkLink, (payload) => {
  const data = payload as NetworkLinkRemoveRequest;
  const link = getNetworkLinkNode(data.self);
  link.removeConnection(data.other);
  return null;
});
registerListener(BecIpcListener.DestroyNetworkLink, (payload) => {
  const data = payload as NetworkLinkDestroyRequest;
  const link = getNetworkLinkNode(data.self);
  link.destroyNode();
  return null;
});
registerListener(
  BecIpcListener.GetRegisteredItemMachine,
  (payload) =>
    InternalRegisteredItemMachine.getInternal(payload as string)?.getData() ??
    null,
);
registerListener(
  BecIpcListener.GetItemMachineStorage,
  getItemMachineStorageHandler,
);
registerListener(
  BecIpcListener.SetItemMachineStorage,
  setItemMachineStorageListener,
);
registerListener(BecIpcListener.GetItemMachineIo, getItemMachineIoHandler);
