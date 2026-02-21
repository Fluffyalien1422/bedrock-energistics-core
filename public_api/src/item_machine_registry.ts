import { IpcListenerType, makeIpcListenerName } from "./ipc_listener_type.js";
import { ipcInvoke, ipcSend } from "./ipc_wrapper.js";
import {
  ItemMachineOnStorageSetPayload,
  RegisteredItemMachineData,
} from "./item_machine_registry_internal.js";
import {
  ItemMachineCallbackName,
  ItemMachineDefinition,
} from "./item_machine_registry_types.js";
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
const ownRegisteredItemMachines = new Map<string, RegisteredItemMachine>();

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
   * Tests if the registered item machine has a specific callback (event or handler).
   * @beta
   * @param name The name of the callback.
   * @returns Whether the item machine defines the specified callback.
   */
  hasCallback(name: ItemMachineCallbackName): boolean {
    switch (name) {
      case "getIo":
        return !!this.data.getIoHandler;
      case "onStorageSet":
        return !!this.data.onStorageSetEvent;
    }
  }

  /**
   * Get an item machine registered by this pack by its ID.
   * @beta
   * @remarks
   * This will only include item machines that have been registered by this pack. If an item machine registered by this pack has been overriden by another pack, this will return the original version registered by this pack. Use {@link RegisteredItemMachine.get} to get item machines registered by any pack.
   * @param id The ID of the item machine to get.
   * @returns The registered item machine, or `undefined` if it does not exist.
   */
  static getOwn(id: string): RegisteredItemMachine | undefined {
    return ownRegisteredItemMachines.get(id);
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

    const isRegistrationOngoing = isRegistrationAllowed();
    // if registration is still ongoing, check own registered item machines first.
    // we don't want to do this if registration has ended, since the item machine
    // may have been overriden by another pack.
    if (isRegistrationOngoing && ownRegisteredItemMachines.has(id)) {
      return ownRegisteredItemMachines.get(id);
    }

    const data = (await ipcInvoke(
      BecIpcListener.GetRegisteredItemMachine,
      id,
    )) as RegisteredItemMachineData | null;

    const result = data ? new RegisteredItemMachine(data) : undefined;

    if (!isRegistrationOngoing) {
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

  const ipcRouter = getIpcRouter();

  let getIoHandler: string | undefined;
  if (definition.handlers?.getIo) {
    getIoHandler = makeIpcListenerName(
      definition.description.id,
      IpcListenerType.ItemMachineGetIoHandler,
    );

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
    onStorageSetEvent = makeIpcListenerName(
      definition.description.id,
      IpcListenerType.ItemMachineOnStorageSetEvent,
    );

    const callback = definition.events.onStorageSet.bind(null);

    ipcRouter.registerListener(onStorageSetEvent, (payloadRaw) => {
      const payload = payloadRaw as ItemMachineOnStorageSetPayload;

      const serializableSlot = SerializableContainerSlot.fromJson(payload.slot);

      void callback({
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
  ownRegisteredItemMachines.set(
    payload.id,
    // @ts-expect-error - internal use of private constructor
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    new RegisteredItemMachine(payload),
  );

  ipcSend(BecIpcListener.RegisterItemMachine, payload);
}
