import {
  MachineCallbackName,
  MachineDefinition,
} from "./machine_registry_types.js";
import {
  IpcMachineOnStorageSetEventArg,
  IpcMachineUpdateUiHandlerArg,
  IpcNetworkStatsEventArg,
  IpcOnButtonPressedPayload,
  IpcRecieveHandlerPayload,
  RegisteredMachineData,
} from "./machine_registry_internal.js";
import { deserializeDimensionLocation } from "./serialize_utils.js";
import { ipcInvoke, ipcSend } from "./ipc_wrapper.js";
import { isRegistrationAllowed } from "./registration_allowed.js";
import { raise } from "./log.js";
import { getIpcRouter } from "./init.js";
import { BecIpcListener } from "./bec_ipc_listener.js";
import { IpcListenerType, makeIpcListenerName } from "./ipc_listener_type.js";
import { MachineUiElements } from "./machine_ui_elements.js";

/**
 * value should be `undefined` if the machine does not exist
 */
const machineCache = new Map<string, RegisteredMachine | undefined>();
const ownRegisteredMachines = new Map<string, RegisteredMachine>();

/**
 * Representation of a machine definition that has been registered.
 * @beta
 * @see {@link MachineDefinition}, {@link registerMachine}
 */
export class RegisteredMachine {
  /**
   * The UI elements of this machine.
   * @beta
   */
  readonly uiElements: MachineUiElements | undefined;

  private constructor(
    /**
     * @internal
     */
    protected readonly data: RegisteredMachineData,
  ) {
    if (data.uiElements) {
      this.uiElements = new MachineUiElements(data.uiElements);
    }
  }

  /**
   * @returns The ID of this machine.
   * @beta
   */
  get id(): string {
    return this.data.id;
  }

  /**
   * @returns The ID for this machine's entity.
   * @beta
   */
  get entityId(): string {
    return this.data.entityId ?? this.data.id;
  }

  /**
   * @returns Whether this machine has a persistent entity or not
   * @beta
   */
  get persistentEntity(): boolean {
    return this.data.persistentEntity ?? false;
  }

  /**
   * @returns The max amount of each storage type in this machine.
   * @beta
   */
  get maxStorage(): number {
    return this.data.maxStorage ?? 6400;
  }

  /**
   * Tests if the registered machine has a specific callback (event or handler).
   * @beta
   * @param name The name of the callback.
   * @returns Whether the machine defines the specified callback.
   */
  hasCallback(name: MachineCallbackName): boolean {
    switch (name) {
      case "onButtonPressed":
        return !!this.data.onButtonPressedEvent;
      case "onNetworkAllocationCompleted":
        return !!this.data.networkStatEvent;
      case "onStorageSet":
        return !!this.data.onStorageSetEvent;
      case "receive":
        return !!this.data.receiveHandlerEvent;
      case "updateUi":
        return !!this.data.updateUiEvent;
    }
  }

  /**
   * Get a machine registered by this pack by its ID.
   * @beta
   * @remarks
   * This will only include machines that have been registered by this pack. If a machine registered by this pack has been overriden by another pack, this will return the original version registered by this pack. Use {@link RegisteredMachine.get} to get machines registered by any pack.
   * @param id The ID of the machine to get.
   * @returns The registered machine, or `undefined` if it does not exist.
   */
  static getOwn(id: string): RegisteredMachine | undefined {
    return ownRegisteredMachines.get(id);
  }

  /**
   * Get a registered machine by its ID.
   * @beta
   * @param id The ID of the machine to get.
   * @returns The registered machine, or `undefined` if it does not exist.
   */
  static async get(id: string): Promise<RegisteredMachine | undefined> {
    if (machineCache.has(id)) {
      return machineCache.get(id);
    }

    const isRegistrationOngoing = isRegistrationAllowed();
    // if registration is still ongoing, check own registered machines first.
    // we don't want to do this if registration has ended, since the machine
    // may have been overriden by another pack.
    if (isRegistrationOngoing && ownRegisteredMachines.has(id)) {
      return ownRegisteredMachines.get(id);
    }

    const data = (await ipcInvoke(
      BecIpcListener.GetRegisteredMachine,
      id,
    )) as RegisteredMachineData | null;

    const result = data ? new RegisteredMachine(data) : undefined;

    if (!isRegistrationOngoing) {
      machineCache.set(id, result);
    }

    return result;
  }

  /**
   * Get a registered machine by its ID or throw an error if it doesn't exist.
   * @beta
   * @param id The ID of the machine to get.
   * @returns The registered machine.
   * @throws Throws if the machine does not exist in the registry.
   */
  static async forceGet(id: string): Promise<RegisteredMachine> {
    const registered = await RegisteredMachine.get(id);
    if (!registered) {
      raise(
        `Expected '${id}' to be registered as a machine, but it could not be found in the machine registry.`,
      );
    }
    return registered;
  }
}

/**
 * Registers a machine. This function should be called in the `worldInitialize` after event.
 * @beta
 * @throws Throws if registration has been closed.
 */
export function registerMachine(definition: MachineDefinition): void {
  if (!isRegistrationAllowed()) {
    raise(
      `Attempted to register machine '${definition.description.id}' after registration was closed.`,
    );
  }

  const ipcRouter = getIpcRouter();

  let updateUiEvent: string | undefined;
  if (definition.handlers?.updateUi) {
    updateUiEvent = makeIpcListenerName(
      definition.description.id,
      IpcListenerType.MachineUpdateUiHandler,
    );

    const callback = definition.handlers.updateUi.bind(null);

    ipcRouter.registerListener(updateUiEvent, (payload) => {
      const data = payload as IpcMachineUpdateUiHandlerArg;

      return callback({
        blockLocation: deserializeDimensionLocation(data.blockLocation),
        entityId: data.entityId,
      });
    });
  }

  let receiveHandlerEvent: string | undefined;
  if (definition.handlers?.receive) {
    receiveHandlerEvent = makeIpcListenerName(
      definition.description.id,
      IpcListenerType.MachineRecieveHandler,
    );

    const callback = definition.handlers.receive.bind(null);

    ipcRouter.registerListener(receiveHandlerEvent, (payload) => {
      const data = payload as IpcRecieveHandlerPayload;

      return callback({
        blockLocation: deserializeDimensionLocation(data.blockLocation),
        receiveType: data.recieveType,
        receiveAmount: data.recieveAmount,
      });
    });
  }

  let onButtonPressedEvent: string | undefined;
  if (definition.events?.onButtonPressed) {
    onButtonPressedEvent = makeIpcListenerName(
      definition.description.id,
      IpcListenerType.MachineOnButtonPressedEvent,
    );

    const callback = definition.events.onButtonPressed.bind(null);

    ipcRouter.registerListener(onButtonPressedEvent, (payload) => {
      const data = payload as IpcOnButtonPressedPayload;
      void callback({
        blockLocation: deserializeDimensionLocation(data.blockLocation),
        playerId: data.playerId,
        entityId: data.entityId,
        elementId: data.elementId,
      });
      return null;
    });
  }

  let networkStatEvent: string | undefined;
  if (definition.events?.onNetworkAllocationCompleted) {
    networkStatEvent = makeIpcListenerName(
      definition.description.id,
      IpcListenerType.MachineNetworkStatEvent,
    );

    const callback = definition.events.onNetworkAllocationCompleted.bind(null);

    ipcRouter.registerListener(networkStatEvent, (payload) => {
      const data = payload as IpcNetworkStatsEventArg;

      void callback({
        blockLocation: deserializeDimensionLocation(data.blockLocation),
        networkData: data.networkData,
      });

      return null;
    });
  }

  let onStorageSetEvent: string | undefined;
  if (definition.events?.onStorageSet) {
    onStorageSetEvent = makeIpcListenerName(
      definition.description.id,
      IpcListenerType.MachineOnStorageSetEvent,
    );

    const callback = definition.events.onStorageSet.bind(null);

    ipcRouter.registerListener(onStorageSetEvent, (payload) => {
      const data = payload as IpcMachineOnStorageSetEventArg;
      void callback({
        blockLocation: deserializeDimensionLocation(data.blockLocation),
        type: data.type,
        value: data.value,
      });
      return null;
    });
  }

  const payload: RegisteredMachineData = {
    // definition
    id: definition.description.id,
    entityId: definition.description.entityId,
    persistentEntity: definition.description.persistentEntity,
    maxStorage: definition.description.maxStorage,
    uiElements: definition.description.ui?.elements,
    // events
    updateUiEvent,
    receiveHandlerEvent,
    onButtonPressedEvent,
    networkStatEvent,
    onStorageSetEvent,
  };
  ownRegisteredMachines.set(
    payload.id,
    // @ts-expect-error - internal use of private constructor
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    new RegisteredMachine(payload),
  );

  ipcSend(BecIpcListener.RegisterMachine, payload);
}
