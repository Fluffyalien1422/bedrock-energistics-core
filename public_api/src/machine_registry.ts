import * as ipc from "mcbe-addon-ipc";
import { MachineDefinition, NetworkStorageTypeData, UiElement } from "./registry_types.js";
import {
  MangledOnButtonPressedPayload,
  MangledRecieveHandlerPayload,
  MangledRegisteredMachine,
} from "./machine_registry_internal.js";
import {
  deserializeDimensionLocation,
  SerializableDimensionLocation,
} from "./serialize_utils.js";
import { ipcInvoke, ipcSend } from "./ipc_wrapper.js";

const UPDATE_UI_HANDLER_SUFFIX = "__h0";
const RECIEVE_HANDLER_SUFFIX = "__h1";
const ON_BUTTON_PRESSED_EVENT_SUFFIX = "__e0";
const NETWORK_STAT_EVENT_SUFFIX = "__i0";

/**
 * Registers a machine. This function should be called in the `worldInitialize` after event.
 * @param shortId If a handler event cannot be created because the block ID is too long, pass a string here to use it as the prefix instead of the block ID.
 * @throws If the block ID is too long and a handler is defined, this function will throw an error. Pass `shortId` to use that as the prefix for handler event IDs instead of the block ID.
 * @beta
 */
export function registerMachine(
  definition: MachineDefinition,
  shortId?: string,
): void {
  const eventIdPrefix = shortId ?? definition.description.id;

  let updateUiEvent: string | undefined;
  if (definition.handlers?.updateUi) {
    updateUiEvent = eventIdPrefix + UPDATE_UI_HANDLER_SUFFIX;

    const callback = definition.handlers.updateUi.bind(null);

    ipc.registerListener(updateUiEvent, (payload) =>
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

    ipc.registerListener(receiveHandlerEvent, (payload) => {
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

    ipc.registerListener(onButtonPressedEvent, (payload) => {
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
  if (definition.handlers?.networkStatEvent) {
    networkStatEvent = eventIdPrefix + NETWORK_STAT_EVENT_SUFFIX;

    const callback = definition.handlers.networkStatEvent.bind(null);

    ipc.registerListener(networkStatEvent, (payload) => {
      const data = payload as {
        blockLocation: SerializableDimensionLocation,
        networkData: Record<string, NetworkStorageTypeData>;
      }

      callback({
        blockLocation: deserializeDimensionLocation(data.blockLocation),
        networkData: data.networkData
      });

      return null;
    });
  }

  const payload: MangledRegisteredMachine = {
    a: definition.description.id,
    b: definition.description.persistentEntity,
    c: definition.description.ui?.elements,
    d: updateUiEvent,
    e: definition.description.entityId,
    f: receiveHandlerEvent,
    g: definition.description.maxStorage,
    h: onButtonPressedEvent,
    i: networkStatEvent
  };

  ipcSend("fluffyalien_energisticscore:ipc.registerMachine", payload);
}

/**
 * Representation of a machine definition that has been registered.
 * @beta
 * @see {@link MachineDefinition}, {@link registerMachine}
 */
export class RegisteredMachine {
  /**
   * @internal
   */
  constructor(
    /**
     * @internal
     */
    protected readonly internal: MangledRegisteredMachine,
  ) {}

  /**
   * @returns The ID of this machine.
   * @beta
   */
  get id(): string {
    return this.internal.a;
  }

  /**
   * @returns The ID for this machine's entity.
   * @beta
   */
  get entityId(): string {
    return this.internal.e ?? this.internal.a;
  }

  /**
   * @returns Whether this machine has a persistent entity or not
   * @beta
   */
  get persistentEntity(): boolean {
    return this.internal.b ?? false;
  }

  /**
   * @returns The max amount of each storage type in this machine.
   */
  get maxStorage(): number {
    return this.internal.g ?? 6400;
  }

  /**
   * @returns The UI elements defined for this machine, or `undefined` if the machine has no UI.
   * @beta
   */
  get uiElements(): Record<string, UiElement> | undefined {
    return this.internal.c;
  }

  /**
   * Gets a registered machine.
   * @beta
   * @param id The ID of the machine.
   * @returns The {@link RegisteredMachine} with the specified `id` or `null` if it doesn't exist.
   * @throws if Bedrock Energistics Core takes too long to respond.
   */
  static async get(id: string): Promise<RegisteredMachine | undefined> {
    const mangled = (await ipcInvoke(
      "fluffyalien_energisticscore:ipc.registeredMachineGet",
      id,
    )) as MangledRegisteredMachine | null;

    if (!mangled) return;

    return new RegisteredMachine(mangled);
  }
}
