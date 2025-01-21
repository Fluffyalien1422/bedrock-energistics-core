import { SerializableContainerSlotJson } from "./serialize_utils.js";

/**
 * @internal
 */
export interface ItemMachineFuncPayload {
  slot: SerializableContainerSlotJson;
}

/**
 * @internal
 */
export interface GetItemMachineStoragePayload extends ItemMachineFuncPayload {
  type: string;
}

/**
 * @internal
 */
export interface SetItemMachineStoragePayload extends ItemMachineFuncPayload {
  type: string;
  value: number;
}
