import { MachineDefinition, UiElement } from "./registry_types.js";
import {
  IpcNetworkStatsEventArg,
  MangledOnButtonPressedPayload,
  MangledRecieveHandlerPayload,
  RegisteredMachineData,
} from "./machine_registry_internal.js";
import {
  deserializeDimensionLocation,
  SerializableDimensionLocation,
} from "./serialize_utils.js";
import { ipcInvoke, ipcSend } from "./ipc_wrapper.js";
import { isRegistrationAllowed } from "./registration_allowed.js";
import { raise } from "./log.js";
import { getIpcRouter } from "./init.js";
import { BecIpcListener } from "./bec_ipc_listener.js";

const UPDATE_UI_HANDLER_SUFFIX = "__h0";
const RECIEVE_HANDLER_SUFFIX = "__h1";
const ON_BUTTON_PRESSED_EVENT_SUFFIX = "__e0";
const NETWORK_STAT_EVENT_SUFFIX = "__e1";

/**
 * value should be `undefined` if the machine does not exist
 */
const machineCache = new Map<string, RegisteredMachine | undefined>();

/**
 * Representation of a machine definition that has been registered.
 * @beta
 * @see {@link MachineDefinition}, {@link registerMachine}
 */
export class RegisteredMachine {
  private constructor(
    /**
     * @internal
     */
    protected readonly data: RegisteredMachineData,
  ) {}

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
   * @returns The UI elements defined for this machine, or `undefined` if the machine has no UI.
   * @beta
   */
  get uiElements(): Record<string, UiElement> | undefined {
    return this.data.uiElements;
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

    const data = (await ipcInvoke(
      BecIpcListener.GetRegisteredMachine,
      id,
    )) as RegisteredMachineData | null;

    const result = data ? new RegisteredMachine(data) : undefined;

    if (!isRegistrationAllowed()) {
      machineCache.set(id, result);
    }

    return result;
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

  const eventIdPrefix = definition.description.id;

  const ipcRouter = getIpcRouter();

  let updateUiEvent: string | undefined;
  if (definition.handlers?.updateUi) {
    updateUiEvent = eventIdPrefix + UPDATE_UI_HANDLER_SUFFIX;

    const callback = definition.handlers.updateUi.bind(null);

    ipcRouter.registerListener(updateUiEvent, (payload) =>
      callback({
        blockLocation: deserializeDimensionLocation(
          payload as SerializableDimensionLocation,
        ),
      }),
    );
  }

  let receiveHandlerEvent: string | undefined;
  if (definition.handlers?.receive) {
    receiveHandlerEvent = eventIdPrefix + RECIEVE_HANDLER_SUFFIX;

    const callback = definition.handlers.receive.bind(null);

    ipcRouter.registerListener(receiveHandlerEvent, (payload) => {
      const data = payload as MangledRecieveHandlerPayload;
      return (
        callback({
          blockLocation: deserializeDimensionLocation(data.a),
          receiveType: data.b,
          receiveAmount: data.c,
        }) ?? data.c
      );
    });
  }

  let onButtonPressedEvent: string | undefined;
  if (definition.events?.onButtonPressed) {
    onButtonPressedEvent = eventIdPrefix + ON_BUTTON_PRESSED_EVENT_SUFFIX;

    const callback = definition.events.onButtonPressed.bind(null);

    ipcRouter.registerListener(onButtonPressedEvent, (payload) => {
      const data = payload as MangledOnButtonPressedPayload;
      callback({
        blockLocation: deserializeDimensionLocation(data.a),
        playerId: data.b,
        entityId: data.c,
        elementId: data.d,
      });
      return null;
    });
  }

  let networkStatEvent: string | undefined;
  if (definition.events?.onNetworkStatsRecieved) {
    networkStatEvent = eventIdPrefix + NETWORK_STAT_EVENT_SUFFIX;

    const callback = definition.events.onNetworkStatsRecieved.bind(null);

    ipcRouter.registerListener(networkStatEvent, (payload) => {
      const data = payload as IpcNetworkStatsEventArg;

      callback({
        blockLocation: deserializeDimensionLocation(data.blockLocation),
        networkData: data.networkData,
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
  };

  ipcSend(BecIpcListener.RegisterMachine, payload);
}
