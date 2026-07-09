import * as ipc from "mcbe-addon-ipc";
import {
  ItemMachineGetIoResponse,
  RegisteredItemMachine,
} from "@/public_api/src";
import { SerializableContainerSlot } from "@/public_api/src/serialize_utils";
import { logWarn, raise } from "./utils/log";
import { ipcInvoke, ipcSend } from "./ipc_wrapper";
import {
  ItemMachineOnStorageSetPayload,
  RegisteredItemMachineData,
} from "@/public_api/src/item_machine_registry_internal";

const itemMachineRegistry = new Map<string, InternalRegisteredItemMachine>();

/**
 * Core-side view of a registered item machine (a machine that lives as an item
 * in a container slot rather than as a placed block). Like
 * {@link InternalRegisteredMachine}, it caches registration data and exposes
 * helpers that dispatch the machine's handlers back to its owning add-on over
 * IPC.
 */
// @ts-expect-error extending private class for internal use
export class InternalRegisteredItemMachine extends RegisteredItemMachine {
  // override to make public
  public constructor(data: RegisteredItemMachineData) {
    super(data);
  }

  getData(): RegisteredItemMachineData {
    return this.data;
  }

  invokeGetIoHandler(
    serializableSlot: SerializableContainerSlot,
  ): Promise<ItemMachineGetIoResponse> {
    if (!this.data.getIoHandler) {
      raise(`Trying to call the 'getIo' handler but it is not defined.`);
    }

    return ipcInvoke(
      this.data.getIoHandler,
      serializableSlot.toJson(),
    ) as Promise<ItemMachineGetIoResponse>;
  }

  callOnStorageSetEvent(
    serializableSlot: SerializableContainerSlot,
    type: string,
    value: number,
  ): void {
    if (!this.data.onStorageSetEvent) {
      raise(`Trying to call the 'onStorageSet' event but it is not defined.`);
    }

    const payload: ItemMachineOnStorageSetPayload = {
      slot: serializableSlot.toJson(),
      type,
      value,
    };

    ipcSend(this.data.onStorageSetEvent, payload);
  }

  static getInternal(id: string): InternalRegisteredItemMachine | undefined {
    return itemMachineRegistry.get(id);
  }

  static forceGetInternal(id: string): InternalRegisteredItemMachine {
    const registered = InternalRegisteredItemMachine.getInternal(id);
    if (!registered) {
      raise(
        `Expected '${id}' to be registered as an item machine, but it could not be found in the item machine registry.`,
      );
    }
    return registered;
  }
}

function registerItemMachine(data: RegisteredItemMachineData): void {
  if (itemMachineRegistry.has(data.id)) {
    logWarn(`Overrode item machine '${data.id}'.`);
  }

  const registered = new InternalRegisteredItemMachine(data);
  itemMachineRegistry.set(data.id, registered);
}

export function registerItemMachineListener(
  payload: ipc.SerializableValue,
): null {
  registerItemMachine(payload as RegisteredItemMachineData);
  return null;
}
