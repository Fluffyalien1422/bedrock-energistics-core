import {
  CREATED_LISTENER_PREFIX,
  IpcListenerType,
} from "./ipc_listener_type.js";
import { ipcInvoke, ipcSend } from "./ipc_wrapper.js";
import {
  ItemMachineOnStorageSetPayload,
  RegisteredItemMachineData,
} from "./item_machine_registry_internal.js";
import { ItemMachineDefinition } from "./item_machine_registry_types.js";
import { raise } from "./log.js";
import { isRegistrationAllowed } from "./registration_allowed.js";
import {
  SerializableContainerSlot,
  SerializableContainerSlotJson,
} from "./serialize_utils.js";
import { BecIpcListener } from "./bec_ipc_listener.js";
import { getIpcRouter } from "./init.js";
import { ItemMachine } from "./item_machine.js";

/**
 * value should be `undefined` if the item machine does not exist
 */
const itemMachineCache = new Map<string, RegisteredItemMachine | undefined>();

/**
 * Representation of an item machine definition that has been registered.
 * @beta
 * @see {@link ItemMachineDefinition}, {@link registerItemMachine}
 */
export class RegisteredItemMachine {
  private constructor(
    /**
     * @internal
     */
    protected readonly data: RegisteredItemMachineData,
  ) {}

  get id(): string {
    return this.data.id;
  }

  get maxStorage(): number {
    return this.data.maxStorage ?? 6400;
  }

  /**
   * Get a registered item machine by its ID.
   * @beta
   * @param id The ID of the item machine to get.
   * @returns The registered item machine, or `undefined` if it does not exist.
   */
  static async get(id: string): Promise<RegisteredItemMachine | undefined> {
    if (itemMachineCache.has(id)) {
      return itemMachineCache.get(id);
    }

    const data = (await ipcInvoke(
      BecIpcListener.GetRegisteredItemMachine,
      id,
    )) as RegisteredItemMachineData | null;

    const result = data ? new RegisteredItemMachine(data) : undefined;

    if (!isRegistrationAllowed()) {
      itemMachineCache.set(id, result);
    }

    return result;
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

  const ipcRouter = getIpcRouter();

  let getIoHandler: string | undefined;
  if (definition.handlers?.getIo) {
    getIoHandler =
      eventIdPrefix + IpcListenerType.ItemMachineGetIoHandler.toString();

    const callback = definition.handlers.getIo.bind(null);

    ipcRouter.registerListener(getIoHandler, (payload) => {
      const serializableSlot = SerializableContainerSlot.fromJson(
        payload as SerializableContainerSlotJson,
      );

      return callback({
        itemMachine: new ItemMachine(
          serializableSlot.inventory,
          serializableSlot.slot,
        ),
      });
    });
  }

  let onStorageSetEvent: string | undefined;
  if (definition.events?.onStorageSet) {
    onStorageSetEvent =
      eventIdPrefix + IpcListenerType.ItemMachineOnStorageSetEvent.toString();

    const callback = definition.events.onStorageSet.bind(null);

    ipcRouter.registerListener(onStorageSetEvent, (payloadRaw) => {
      const payload = payloadRaw as ItemMachineOnStorageSetPayload;

      const serializableSlot = SerializableContainerSlot.fromJson(payload.slot);

      callback({
        itemMachine: new ItemMachine(
          serializableSlot.inventory,
          serializableSlot.slot,
        ),
        type: payload.type,
        value: payload.value,
      });

      return null;
    });
  }

  const payload: RegisteredItemMachineData = {
    id: definition.description.id,
    maxStorage: definition.description.maxStorage,
    defaultIo: definition.description.defaultIo,
    getIoHandler,
    onStorageSetEvent,
  };

  ipcSend(BecIpcListener.RegisterItemMachine, payload);
}
