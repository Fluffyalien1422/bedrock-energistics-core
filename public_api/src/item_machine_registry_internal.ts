import { ItemMachineGetIoResponse } from "./item_machine_registry_types.js";
import { SerializableContainerSlotJson } from "./serialize_utils.js";

/**
 * @internal
 */
export interface RegisteredItemMachineData {
  id: string;
  maxStorage?: number;
  defaultIo?: ItemMachineGetIoResponse;
  getIoHandler?: string;
  onStorageSetEvent?: string;
}

/**
 * @internal
 */
export interface ItemMachineOnStorageSetPayload {
  slot: SerializableContainerSlotJson;
  type: string;
  value: number;
}
