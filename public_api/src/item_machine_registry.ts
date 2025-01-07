import * as ipc from "mcbe-addon-ipc";
import {
  CREATED_LISTENER_PREFIX,
  IpcListenerType,
} from "./ipc_listener_type.js";
import { ipcSend } from "./ipc_wrapper.js";
import { RegisteredItemMachineData } from "./item_machine_registry_internal.js";
import { ItemMachineDefinition } from "./item_machine_registry_types.js";
import { raise } from "./log.js";
import { isRegistrationAllowed } from "./registration_allowed.js";
import {
  SerializableContainerSlot,
  SerializableContainerSlotJson,
} from "./serialize_utils.js";

/**
 * Representation of an item machine definition that has been registered.
 * @beta
 * @see {@link ItemMachineDefinition}, {@link registerItemMachine}
 */
export class RegisteredItemMachine {
  private constructor(protected readonly data: RegisteredItemMachineData) {}

  get id(): string {
    return this.data.id;
  }

  get maxStorage(): number {
    return this.data.maxStorage ?? 6400;
  }

  get loreDisplay(): boolean {
    return this.data.loreDisplay ?? true;
  }
}

/**
 * Registers an item machine. This function should be called in the `worldInitialize` after event.
 * @beta
 * @throws Throws if registration has been closed.
 */
export function registerItemMachine(definition: ItemMachineDefinition): void {
  if (!isRegistrationAllowed()) {
    raise(
      `Attempted to register item machine '${definition.description.id}' after registration was closed.`,
    );
  }

  const eventIdPrefix = definition.description.id + CREATED_LISTENER_PREFIX;

  let getIoHandler: string | undefined;
  if (definition.handlers?.getIo) {
    getIoHandler =
      eventIdPrefix + IpcListenerType.ItemMachineGetIoHandler.toString();

    const callback = definition.handlers.getIo.bind(null);

    ipc.registerListener(getIoHandler, (payload) => {
      const serializableSlot = SerializableContainerSlot.fromJson(
        payload as SerializableContainerSlotJson,
      );

      return callback({
        inventory: serializableSlot.inventory,
        slot: serializableSlot.slot,
      });
    });
  }

  const payload: RegisteredItemMachineData = {
    id: definition.description.id,
    maxStorage: definition.description.maxStorage,
    loreDisplay: definition.description.loreDisplay,
    getIoHandler,
  };

  ipcSend("fluffyalien_energisticscore:ipc.registerItemMachine", payload);
}
