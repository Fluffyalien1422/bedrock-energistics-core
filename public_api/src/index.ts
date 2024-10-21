/**
 * @module API
 */

import { Block, DimensionLocation, ItemTypes, system } from "@minecraft/server";
import {
  MachineDefinition,
  StorageTypeDefinition,
  UiElement,
  UpdateUiHandlerResponse,
} from "./registry_types.js";
import {
  deserializeDimensionLocation,
  getBlockUniqueId,
  getItemCountScoreboardObjective,
  getItemTypeScoreboardObjective,
  getScore,
  getStorageScoreboardObjective,
  logInfo,
  makeErrorString,
  makeSerializableDimensionLocation,
  MangledOnButtonPressedPayload,
  MangledRecieveHandlerPayload,
  MangledRegisteredMachine,
  removeBlockFromScoreboards,
  SerializableDimensionLocation,
} from "./internal.js";
import {
  dispatchScriptEvent,
  invokeScriptEvent,
  registerScriptEventHandler,
  registerScriptEventListener,
  streamScriptEvent,
} from "mcbe-addon-ipc";
import { ensureInitialized, getInitNamespace } from "./init.js";

export { init, InitOptions } from "./init.js";
export * from "./registry_types.js";
export * from "./network_links/network_link_node.js";
export * as machineIO from "./machines/machine_io.js";

const UPDATE_UI_HANDLER_SUFFIX = "__h0";
const RECIEVE_HANDLER_SUFFIX = "__h1";
const ON_BUTTON_PRESSED_EVENT_SUFFIX = "__e0";

/**
 * Representation of an item stack stored in a machine inventory.
 * @beta
 */
export interface MachineItemStack {
  /**
   * The index of the item in the slot's `allowedItems`.
   * @see {@link UiItemSlotElement}
   */
  typeIndex: number;
  /**
   * The amount of this item.
   */
  count: number;
}

/**
 * Representation of a machine definition that has been registered.
 * @beta
 * @see {@link MachineDefinition}, {@link registerMachine}, {@link getRegisteredMachine}
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
}

/**
 * Tests whether Bedrock Energistics Core is in the world or not.
 * @beta
 */
export function isBedrockEnergisticsCoreInWorld(): boolean {
  return !!ItemTypes.get(
    "fluffyalien_energisticscore:ui_disabled_storage_bar_segment",
  );
}

/**
 * Registers a machine. This function should be called in the `worldInitialize` after event.
 * @param shortId If a handler event cannot be created because the block ID is too long, pass a string here to use it as the prefix instead of the block ID.
 * @param fallbackToStream If the {@link MachineDefinition} cannot be sent, fall back to streaming.
 * @throws If the block ID is too long and a handler is defined, this function will throw an error. Pass `shortId` to use that as the prefix for handler event IDs instead of the block ID.
 * @beta
 */
export function registerMachine(
  definition: MachineDefinition,
  shortId?: string,
  fallbackToStream = true,
): void {
  ensureInitialized();

  const eventIdPrefix = shortId ?? definition.description.id;

  let updateUiEvent: string | undefined;
  if (definition.handlers?.updateUi) {
    updateUiEvent = eventIdPrefix + UPDATE_UI_HANDLER_SUFFIX;

    const callback = definition.handlers.updateUi.bind(null);

    registerScriptEventHandler<
      SerializableDimensionLocation,
      UpdateUiHandlerResponse
    >(updateUiEvent, (payload) =>
      callback({
        blockLocation: deserializeDimensionLocation(payload),
      }),
    );
  }

  let receiveHandlerEvent: string | undefined;
  if (definition.handlers?.receive) {
    receiveHandlerEvent = eventIdPrefix + RECIEVE_HANDLER_SUFFIX;

    const callback = definition.handlers.receive.bind(null);

    registerScriptEventHandler<MangledRecieveHandlerPayload, number>(
      receiveHandlerEvent,
      (payload) =>
        callback({
          blockLocation: deserializeDimensionLocation(payload.a),
          receiveType: payload.b,
          receiveAmount: payload.c,
        }) ?? payload.c,
    );
  }

  let onButtonPressedEvent: string | undefined;
  if (definition.events?.onButtonPressed) {
    onButtonPressedEvent = eventIdPrefix + ON_BUTTON_PRESSED_EVENT_SUFFIX;

    const callback = definition.events.onButtonPressed.bind(null);

    registerScriptEventListener<MangledOnButtonPressedPayload>(
      onButtonPressedEvent,
      (payload) => {
        callback({
          blockLocation: deserializeDimensionLocation(payload.a),
          playerId: payload.b,
          entityId: payload.c,
          elementId: payload.d,
        });
      },
    );
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
  };

  try {
    dispatchScriptEvent(
      "fluffyalien_energisticscore:ipc.registerMachine",
      payload,
    );
  } catch (err) {
    const caughtErrMessage = `caught error when trying to register machine '${definition.description.id}': ${err instanceof Error || typeof err === "string" ? err.toString() : "unknown error"}`;

    if (!fallbackToStream) {
      throw new Error(
        makeErrorString(
          `${caughtErrMessage}. falling back to streaming is disabled`,
        ),
      );
    }

    logInfo(`${caughtErrMessage}. falling back to streaming`);

    system.runJob(
      streamScriptEvent(
        "fluffyalien_energisticscore:ipc.stream.registerMachine",
        getInitNamespace(),
        payload,
      ),
    );

    return;
  }
}

/**
 * Registers a storage type. This function should be called in the `worldInitialize` after event.
 * @beta
 */
export function registerStorageType(definition: StorageTypeDefinition): void {
  ensureInitialized();

  if (definition.id.startsWith("_") || definition.category.startsWith("_")) {
    throw new Error(
      `can't register storage type '${definition.id}' (category: '${definition.category}'): storage type IDs and categories cannot start with '_'`,
    );
  }

  // reconstruct the definition in case the passed `definition` contains unnecessary keys
  const payload: StorageTypeDefinition = {
    id: definition.id,
    category: definition.category,
    color: definition.color,
    name: definition.name,
  };

  dispatchScriptEvent(
    "fluffyalien_energisticscore:ipc.registerStorageType",
    payload,
  );
}

/**
 * Updates the networks that a machine belongs to, if it has any.
 * @beta
 */
export function updateMachineNetworks(blockLocation: DimensionLocation): void {
  dispatchScriptEvent(
    "fluffyalien_energisticscore:ipc.updateMachineNetworks",
    makeSerializableDimensionLocation(blockLocation),
  );
}

/**
 * Updates the networks adjacent to a machine that the machine can connect to.
 * @beta
 */
export function updateMachineConnectableNetworks(
  blockLocation: DimensionLocation,
): void {
  dispatchScriptEvent(
    "fluffyalien_energisticscore:ipc.updateMachineConnectableNetworks",
    makeSerializableDimensionLocation(blockLocation),
  );
}

/**
 * Updates the networks adjacent to a block.
 * @beta
 */
export function updateMachineAdjacentNetworks(
  blockLocation: DimensionLocation,
): void {
  dispatchScriptEvent(
    "fluffyalien_energisticscore:ipc.updateMachineAdjacentNetworks",
    makeSerializableDimensionLocation(blockLocation),
  );
}

/**
 * Gets the storage of a specific type in a machine.
 * @beta
 * @param loc The location of the machine.
 * @param type The type of storage to get.
 * @throws Throws {@link Error} if the storage type does not exist
 */
export function getMachineStorage(
  loc: DimensionLocation,
  type: string,
): number {
  const objective = getStorageScoreboardObjective(type);

  if (!objective) {
    throw new Error(
      makeErrorString(
        `trying to get machine storage of type '${type}' but that storage type does not exist`,
      ),
    );
  }

  return getScore(objective, getBlockUniqueId(loc)) ?? 0;
}

/**
 * Sets the storage of a specific type in a machine.
 * @beta
 * @param block The machine block.
 * @param type The type of storage to set.
 * @param value The new value. Must be an integer.
 * @throws Throws if the storage type does not exist.
 * @throws Throws if the new value isn't a non-negative integer.
 * @throws Throws if the block is not valid
 */
export function setMachineStorage(
  block: Block,
  type: string,
  value: number,
): void {
  if (!block.isValid()) {
    throw new Error(
      makeErrorString(
        `trying to set machine storage but the block is not valid`,
      ),
    );
  }

  if (value < 0) {
    throw new Error(
      makeErrorString(
        `trying to set machine storage of type '${type}' to ${value.toString()} which is less than the minimum value (0)`,
      ),
    );
  }

  const objective = getStorageScoreboardObjective(type);
  if (!objective) {
    throw new Error(
      makeErrorString(
        `trying to set machine storage of type '${type}' but that storage type does not exist`,
      ),
    );
  }

  objective.setScore(getBlockUniqueId(block), value);
}

/**
 * Gets an item from a machine inventory.
 * @beta
 * @param loc The location of the machine.
 * @param slotId The number ID of the slot as defined when the machine was registered (see {@link UiItemSlotElement}).
 * @returns The {@link MachineItemStack}.
 */
export function getMachineSlotItem(
  loc: DimensionLocation,
  slotId: number,
): MachineItemStack | undefined {
  const participantId = getBlockUniqueId(loc);

  const itemType = getScore(
    getItemTypeScoreboardObjective(slotId),
    participantId,
  );
  if (itemType === undefined) {
    return;
  }

  const itemCount = getScore(
    getItemCountScoreboardObjective(slotId),
    participantId,
  );
  if (!itemCount) {
    return;
  }

  return {
    typeIndex: itemType,
    count: itemCount,
  };
}

/**
 * Sets an item in a machine inventory.
 * @beta
 * @param loc The location of the machine.
 * @param slotId The number ID of the slot as defined when the machine was registered (see {@link UiItemSlotElement}).
 * @param newItemStack The {@link MachineItemStack} to put in the slot. Pass `undefined` to remove the item in the slot.
 */
export function setMachineSlotItem(
  loc: DimensionLocation,
  slotId: number,
  newItemStack?: MachineItemStack,
): void {
  dispatchScriptEvent("fluffyalien_energisticscore:ipc.setMachineSlot", {
    loc: makeSerializableDimensionLocation(loc),
    slot: slotId,
    item: newItemStack,
  });
}

/**
 * Queue sending a storage type over a machine network.
 * @beta
 * @remarks
 * Note: in most cases, prefer {@link generate} over this function.
 * Automatically sets the machine's reserve storage to the amount that was not received.
 * @param blockLocation The location of the machine that is sending the storage type.
 * @param type The storage type to send.
 * @param amount The amount to send.
 * @throws if `amount` is <= 0.
 * @see {@link generate}
 */
export function queueSend(
  blockLocation: DimensionLocation,
  type: string,
  amount: number,
): void {
  dispatchScriptEvent("fluffyalien_energisticscore:ipc.queueSend", {
    loc: makeSerializableDimensionLocation(blockLocation),
    type,
    amount,
  });
}

/**
 * Sends a storage type over a machine network. Includes reserve storage as well.
 * @beta
 * @remarks
 * This function should be called every block tick for generators even if the generation is `0` because it sends reserve storage.
 * Automatically sets the machine's reserve storage to the amount that was not received.
 * This function is a wrapper around {@link queueSend}.
 * Unlike `queueSend`, this function does not throw if `amount` <= 0.
 * @param blockLocation The location of the machine that is generating.
 * @param type The storage type to generate.
 * @param amount The amount to generate.
 * @see {@link queueSend}
 */
export function generate(
  blockLocation: DimensionLocation,
  type: string,
  amount: number,
): void {
  const stored = getMachineStorage(blockLocation, type);

  const sendAmount = stored + amount;
  if (sendAmount <= 0) {
    return;
  }

  queueSend(blockLocation, type, sendAmount);
}

/**
 * Gets a registered machine.
 * @beta
 * @param id The ID of the machine.
 * @returns The {@link RegisteredMachine} with the specified `id` or `null` if it doesn't exist.
 * @throws if Bedrock Energistics Core takes too long to respond.
 */
export async function getRegisteredMachine(
  id: string,
): Promise<RegisteredMachine | null> {
  ensureInitialized();

  const mangled = (await invokeScriptEvent(
    "fluffyalien_energisticscore:ipc.getRegisteredMachine",
    getInitNamespace(),
    id,
  )) as MangledRegisteredMachine;

  return new RegisteredMachine(mangled);
}

/**
 * Cleans up machine data and updates it's networks.
 * @beta
 * @remarks
 * This is automatically done by Bedrock Energistics Core when a machine is destroyed by a player.
 * If you destroy a machine from script, call this function before the block is removed.
 * @param blockLocation The location of the machine.
 */
export function removeMachine(blockLocation: DimensionLocation): void {
  updateMachineNetworks(blockLocation);
  system.run(() => {
    removeBlockFromScoreboards(blockLocation);
  });
}
