import { SerializableContainerSlotJson } from "./serialize_utils.js";

/**
 * @beta
 */
export interface ItemMachineFuncPayload {
  slot: SerializableContainerSlotJson;
}

/**
 * @beta
 */
export interface GetItemMachineStoragePayload extends ItemMachineFuncPayload {
  type: string;
}

/**
 * @beta
 */
export interface SetItemMachineStoragePayload extends ItemMachineFuncPayload {
  type: string;
  value: number;
}
