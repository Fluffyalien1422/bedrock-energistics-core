import {
  BlockInventoryComponent,
  ContainerSlot,
  EntityInventoryComponent,
} from "@minecraft/server";
import {
  SerializableContainerSlot,
  SerializableContainerSlotJson,
} from "./serialize_utils.js";
import { PublicErrorType } from "./error.js";
import { raisePublic } from "./log.js";
import { ipcInvoke, ipcSend } from "./ipc_wrapper.js";
import {
  GetItemMachineStoragePayload,
  ItemMachineFuncPayload,
  SetItemMachineStoragePayload,
} from "./item_machine_internal.js";
import { BecIpcListener } from "./bec_ipc_listener.js";
import { IoCapabilities } from "./io.js";
import { ItemMachineGetIoResponse } from "./item_machine_registry_types.js";

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
   * @throws Throws a {@link PublicError} of type {@link PublicErrorType.NotFound} if an item is not found in the specified slot.
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
      raisePublic(
        PublicErrorType.NotFound,
        "Could not get the item in the specified slot.",
      );
    }

    this.typeId = typeId;

    const serializableContainerSlot = new SerializableContainerSlot(
      inventory,
      slot,
    );

    this.containerSlotJson = serializableContainerSlot.toJson();
  }

  /**
   * Is this object valid?
   * @beta
   * @returns `true` if the type ID of the item in the specified slot has NOT changed since the creation of this object, otherwise `false`.
   */
  isValid(): boolean {
    return this.inventory.container?.getItem(this.slot)?.typeId === this.typeId;
  }

  /**
   * Get the container slot that this item is in.
   * @beta
   * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidObject} if this object is not valid.
   */
  getContainerSlot(): ContainerSlot {
    this.ensureValidity();
    return this.inventory.container!.getSlot(this.slot);
  }

  /**
   * Gets the storage of a specific type in the item machine.
   * @beta
   * @param type The type of storage to get.
   * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidObject} if this object is not valid, or if the item's inventory is no longer valid.
   * @throws Throws a {@link PublicError} of type {@link PublicErrorType.NotRegistered} if the storage type does not exist.
   * @throws Throws a {@link PublicError} of type {@link PublicErrorType.NotFound} if the block or entity holding the item no longer exists.
   * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidState} if this package has not been initialized (see {@link init}).
   */
  // `async` so that a failed validity check rejects the returned promise
  // instead of throwing synchronously, matching the other methods here.
  async getStorage(type: string): Promise<number> {
    this.ensureValidity();

    const payload: GetItemMachineStoragePayload = {
      slot: this.containerSlotJson,
      type,
    };

    return await ipcInvoke<number>(
      BecIpcListener.GetItemMachineStorage,
      payload,
    );
  }

  /**
   * Sets the storage of a specific type in the item machine.
   * @beta
   * @param type The type of storage to set.
   * @param value The new value. Must be a non-negative integer.
   * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidObject} if this object is not valid.
   * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidArgument} if the new value isn't a non-negative integer.
   * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidState} if this package has not been initialized (see {@link init}).
   */
  setStorage(type: string, value: number): void {
    this.ensureValidity();

    // Checked here rather than in the core pack: this is a one-way call, so an
    // error raised on the other side would only reach that pack's log.
    if (!Number.isInteger(value) || value < 0) {
      raisePublic(
        PublicErrorType.InvalidArgument,
        `Failed to set item machine storage of type '${type}' to ${value.toString()}. The value must be a non-negative integer.`,
      );
    }

    const payload: SetItemMachineStoragePayload = {
      slot: this.containerSlotJson,
      type,
      value,
    };

    ipcSend(BecIpcListener.SetItemMachineStorage, payload);
  }

  /**
   * Get the I/O capabilities of this item machine.
   * @beta
   * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidObject} if this object is not valid, or if the item's inventory is no longer valid.
   * @throws Throws a {@link PublicError} of type {@link PublicErrorType.NotRegistered} if the item is not registered as an item machine.
   * @throws Throws a {@link PublicError} of type {@link PublicErrorType.NotFound} if the block or entity holding the item no longer exists.
   * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidState} if this package has not been initialized (see {@link init}).
   */
  async getIo(): Promise<IoCapabilities> {
    this.ensureValidity();

    const payload: ItemMachineFuncPayload = {
      slot: this.containerSlotJson,
    };

    const ioData = await ipcInvoke<Required<ItemMachineGetIoResponse>>(
      BecIpcListener.GetItemMachineIo,
      payload,
    );

    if (ioData.acceptsAny) {
      return IoCapabilities.acceptingAny();
    } else {
      return IoCapabilities.accepting(ioData.types, ioData.categories);
    }
  }

  private ensureValidity(): void {
    if (!this.isValid()) {
      raisePublic(
        PublicErrorType.InvalidObject,
        "The type ID of the item in the specified slot has changed since the creation of this object.",
      );
    }
  }
}
