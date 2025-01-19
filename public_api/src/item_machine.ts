import {
  BlockInventoryComponent,
  EntityInventoryComponent,
} from "@minecraft/server";
import {
  SerializableContainerSlot,
  SerializableContainerSlotJson,
} from "./serialize_utils.js";
import { raise } from "./log.js";
import { ipcInvoke, ipcSend } from "./ipc_wrapper.js";
import {
  GetItemMachineStoragePayload,
  SetItemMachineStoragePayload,
} from "./item_machine_internal.js";
import { BecIpcListener } from "./bec_ipc_listener.js";

/**
 * Representation of an item machine.
 * @beta
 * @see {@link registerItemMachine}.
 */
export class ItemMachine {
  private readonly containerSlotJson: SerializableContainerSlotJson;
  /**
   * The item type ID.
   * @beta
   */
  readonly typeId: string;

  /**
   * @throws Throws if an item is not found in the specified slot.
   */
  constructor(
    /**
     * The inventory that the item is in.
     * @beta
     */
    readonly inventory: BlockInventoryComponent | EntityInventoryComponent,
    /**
     * The slot index that the item is in.
     * @beta
     */
    readonly slot: number,
  ) {
    const typeId = inventory.container?.getItem(slot)?.typeId;
    if (!typeId) {
      raise("Could not get the item in the specified slot.");
    }

    this.typeId = typeId;

    const serializableContainerSlot = new SerializableContainerSlot(
      inventory,
      slot,
    );

    this.containerSlotJson = serializableContainerSlot.toJson();
  }

  /**
   * @beta
   * @returns `true` if the type ID of the item in the specified slot has NOT changed since the creation of this object, otherwise `false`.
   */
  isValid(): boolean {
    return this.inventory.container?.getItem(this.slot)?.typeId === this.typeId;
  }

  /**
   * Gets the storage of a specific type in the item machine.
   * @beta
   * @param type The type of storage to get.
   * @throws Throws if the storage type does not exist
   * @throws If this object is not valid.
   */
  getStorage(type: string): Promise<number> {
    this.ensureValidity();

    const payload: GetItemMachineStoragePayload = {
      slot: this.containerSlotJson,
      type,
    };

    return ipcInvoke(
      BecIpcListener.GetItemMachineStorage,
      payload,
    ) as Promise<number>;
  }

  /**
   * Sets the storage of a specific type in the item machine.
   * @beta
   * @param type The type of storage to set.
   * @param value The new value. Must be an integer.
   * @throws If this object is not valid.
   */
  setStorage(type: string, value: number): void {
    this.ensureValidity();

    const payload: SetItemMachineStoragePayload = {
      slot: this.containerSlotJson,
      type,
      value,
    };

    ipcSend(BecIpcListener.SetItemMachineStorage, payload);
  }

  private ensureValidity(): void {
    if (!this.isValid()) {
      raise(
        "The type ID of the item in the specified slot has changed since the creation of this object.",
      );
    }
  }
}
