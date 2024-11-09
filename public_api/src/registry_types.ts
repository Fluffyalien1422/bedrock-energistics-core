import { DimensionLocation } from "@minecraft/server";

// ui

/**
 * @beta
 */
export type UiProgressIndicatorElementType = "arrow" | "flame";

/**
 * @beta
 */
export interface UiStorageBarElementUpdateOptions {
  /**
   * The type of this storage bar. Set to "_disabled" to disable the storage bar.
   * @default "_disabled"
   */
  type?: string;
  /**
   * The amount that this storage type is changing per tick. This can be any integer.
   * @default 0
   */
  change?: number;
  /**
   * The max amount to display on this on storage bar. Defaults to {@link MachineDefinitionDescription.maxStorage}
   */
  max?: number;
}

/**
 * Options for defining a storage bar UI element.
 * @remarks
 * A storage bar element takes up 4 slots in an inventory,
 * so ensure that the machine entity's inventory is properly sized.
 * @beta
 */
export interface UiStorageBarElement {
  type: "storageBar";
  startIndex: number;
  defaults?: UiStorageBarElementUpdateOptions;
}

/**
 * Options for defining an item slot UI element.
 * @remarks
 * This is used to store items without persistent entities.
 * If your machine uses a persistent entity, we recommend
 * accessing the entity's inventory directly rather than using this.
 * @beta
 */
export interface UiItemSlotElement {
  type: "itemSlot";
  index: number;
  slotId: number;
  allowedItems: string[];
}

/**
 * Options for defining a progress indicator UI element.
 * @beta
 */
export interface UiProgressIndicatorElement {
  type: "progressIndicator";
  indicator: UiProgressIndicatorElementType;
  index: number;
}

/**
 * @beta
 */
export interface UiButtonElementUpdateOptions {
  /**
   * The item to use as the button. This item must have the `fluffyalien_energisticscore:ui_item` tag.
   * @default "fluffyalien_energisticscore:ui_empty_slot"
   */
  itemId?: string;
  /**
   * The name tag for the item.
   */
  name?: string;
}

/**
 * Options for defining a button UI element.
 * @beta
 */
export interface UiButtonElement {
  type: "button";
  index: number;
  /**
   * The default options for this button if nothing is specified in `updateUi`.
   */
  defaults?: UiButtonElementUpdateOptions;
}

/**
 * See each element type for more information.
 * @beta
 */
export type UiElement =
  | UiStorageBarElement
  | UiItemSlotElement
  | UiProgressIndicatorElement
  | UiButtonElement;

/**
 * @beta
 */
export interface UiOptions {
  elements: Record<string, UiElement>;
}

/**
 * @beta
 */
export interface MachineDefinitionDescription {
  id: string;
  /**
   * The ID of the machine entity. Defaults to the value of `id`.
   */
  entityId?: string;
  /**
   * Is the machine entity persistent?
   * See [Persistent Entities](https://fluffyalien1422.github.io/bedrock-energistics-core/documents/Guides.Persistent_Entities.html).
   */
  persistentEntity?: boolean;
  /**
   * Max amount of each storage type in this machine.
   * @default 6400
   */
  maxStorage?: number;
  /**
   * UI options for your machine.
   * If this is undefined, then Bedrock Energistics Core will skip UI handling for this machine entity.
   */
  ui?: UiOptions;
}

// common callback types

/**
 * @beta
 */
export interface MachineCallbackArg {
  blockLocation: DimensionLocation;
}

/**
 * @beta
 */
export type MachineCallback<TArg extends MachineCallbackArg, TReturn> = (
  this: null,
  arg: TArg,
) => TReturn;

// events

/**
 * @beta
 */
export type MachineEventCallback<TArg extends MachineCallbackArg> =
  MachineCallback<TArg, void>;

/**
 * @beta
 */
export interface MachineOnButtonPressedEventArg extends MachineCallbackArg {
  /**
   * The ID of the player who "pressed" the button.
   * @beta
   */
  playerId: string;
  /**
   * The ID of the machine entity.
   * @beta
   */
  entityId: string;
  /**
   * The ID of the button element.
   * @beta
   */
  elementId: string;
}

/**
 * @beta
 */
export interface MachineDefinitionEvents {
  onButtonPressed?: MachineEventCallback<MachineOnButtonPressedEventArg>;

  /**
   * Called after a network has completed sending machine storage allocations
   * contains information on each category sent in that pass with the starting and remaining budget.
   */
  onNetworkStatsRecieved?: MachineEventCallback<NetworkStatsEventArg>;
}

// handlers

/**
 * @beta
 */
export interface MachineRecieveHandlerArg extends MachineCallbackArg {
  receiveType: string;
  receiveAmount: number;
}

/**
 * @beta
 */
export interface UpdateUiHandlerResponse {
  storageBars?: Record<string, UiStorageBarElementUpdateOptions>;
  progressIndicators?: Record<string, number>;
  buttons?: Record<string, UiButtonElementUpdateOptions>;
}

/**
 * @beta
 */
export interface NetworkStorageTypeData {
  /**
   * The amount of this storage type that was available on this network *before* distribution
   */
  before: number;

  /**
   * The amount of this storage type that was available on this network *after* distribution
   */
  after: number;
}

/**
 * @beta
 */
export interface NetworkStatsEventArg extends MachineCallbackArg {
  /**
   * Contains an object where each key is a storage type ID and the value contains the amount that was available on this network
   */
  networkData: Record<string, NetworkStorageTypeData>;
}

/**
 * @beta
 */
export interface MachineDefinitionHandlers {
  updateUi?: MachineCallback<MachineCallbackArg, UpdateUiHandlerResponse>;
  /**
   * Called before a machine recieves a storage type.
   * @returns a number that overrides the amount that was received
   * (must be a non-negative integer),
   * or `undefined` to not change anything.
   */
  receive?: MachineCallback<MachineRecieveHandlerArg, number | undefined>;
}

// registered machine

/**
 * @beta
 */
export interface MachineDefinition {
  description: MachineDefinitionDescription;
  handlers?: MachineDefinitionHandlers;
  events?: MachineDefinitionEvents;
}

// storage type options

/**
 * @beta
 */
export type StorageTypeColor =
  | "black"
  | "orange"
  | "pink"
  | "purple"
  | "red"
  | "yellow";

/**
 * @beta
 */
export interface StorageTypeDefinition {
  id: string;
  category: string;
  color: StorageTypeColor;
  name: string;
}
