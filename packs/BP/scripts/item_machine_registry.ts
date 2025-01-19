import * as ipc from "mcbe-addon-ipc";
import {
  ItemMachineGetIoResponse,
  RegisteredItemMachine,
} from "@/public_api/src";
import { SerializableContainerSlot } from "@/public_api/src/serialize_utils";
import {
  BlockInventoryComponent,
  EntityInventoryComponent,
} from "@minecraft/server";
import { logInfo, raise } from "./utils/log";
import { ipcInvoke } from "./ipc_wrapper";
import { RegisteredItemMachineData } from "@/public_api/src/item_machine_registry_internal";

const itemMachineRegistry = new Map<string, InternalRegisteredItemMachine>();

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
    inventory: EntityInventoryComponent | BlockInventoryComponent,
    slot: number,
  ): Promise<ItemMachineGetIoResponse> {
    if (!this.data.getIoHandler) {
      raise(`Trying to call the 'getIo' handler but it is not defined.`);
    }

    const serializableSlot = new SerializableContainerSlot(inventory, slot);

    return ipcInvoke(
      this.data.getIoHandler,
      serializableSlot.toJson(),
    ) as Promise<ItemMachineGetIoResponse>;
  }

  static getInternal(id: string): InternalRegisteredItemMachine | undefined {
    return itemMachineRegistry.get(id);
  }
}

function registerItemMachine(data: RegisteredItemMachineData): void {
  if (itemMachineRegistry.has(data.id)) {
    logInfo(`Overrode item machine '${data.id}'.`);
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
