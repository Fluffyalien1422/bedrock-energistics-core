import { DimensionLocation } from "@minecraft/server";
import { BaseIpcCallback } from "./common_registry_types.js";
import {
  StorageTypeTextureDescription,
  StorageTypeTexturePreset,
} from "./storage_type_registry_types.js";

// ui

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
   * Use this property to override the label of the storage bar.
   */
  label?: string;
  /**
   * The max amount to display on this on storage bar. Defaults to {@link MachineDefinitionDescription.maxStorage}
   */
  max?: number;
  /**
   * Use this property to override the {@link StorageTypeDefinition.texture} for this machine.
   */
  textureOverride?: StorageTypeTextureDescription | StorageTypeTexturePreset;
}

/**
 * Options for defining a storage bar UI element.
 * @remarks
 * A storage bar element takes up 4 slots in an inventory,
 * so ensure that the machine entity's inventory is properly sized.
 * @beta
 */
export interface UiStorageBarElementDefinition {
  type: "storageBar";
  startIndex: number;
  /**
   * The amount of item slots to use.
   * @default 4
   */
  size?: number;
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
export interface UiItemSlotElementDefinition {
  type: "itemSlot";
  index: number;
  /**
   * Only allow specific items in this slot.
   * @beta
   */
  allowedItems?: string[];

  /**
   * The item ID to use when the slot is empty.
   * - If not provided will fall back to "fluffyalien_energisticscore:ui_empty_slot"
   */
  emptyItemId?: string;
}

/**
 * A progress indicator preset for the {@link UiProgressIndicatorElementDefinition} element definition.
 * @beta
 */
export type UiProgressIndicatorPreset = "arrow" | "flame";

/**
 * A progress indicator description for the {@link UiProgressIndicatorElementDefinition} element definition.
 * @beta
 */
export interface UiProgressIndicatorDescription {
  /**
   * An array of item IDs to use as frames for the progress indicator.
   * @beta
   * @remarks
   * All items must have the `fluffyalien_energisticscore:ui_item` tag.
   */
  frames: string[];
}

/**
 * Options for defining a progress indicator UI element.
 * @beta
 */
export interface UiProgressIndicatorElementDefinition {
  type: "progressIndicator";
  indicator: UiProgressIndicatorDescription | UiProgressIndicatorPreset;
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
export interface UiButtonElementDefinition {
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
export type UiElementDefinition =
  | UiStorageBarElementDefinition
  | UiItemSlotElementDefinition
  | UiProgressIndicatorElementDefinition
  | UiButtonElementDefinition;

/**
 * @beta
 */
export interface UiOptions {
  elements: Record<string, UiElementDefinition>;
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
   * See [Persistent Entities](https://fluffyalien1422.github.io/bedrock-energistics-core/api/documents/Guides.Persistent_Entities.html).
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
export type MachineCallback<
  TArg extends MachineCallbackArg,
  TReturn,
> = BaseIpcCallback<TArg, TReturn>;

// events

/**
 * @beta
 */
export type MachineEventCallback<TArg extends MachineCallbackArg> =
  BaseIpcCallback<TArg, void>;

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
export interface MachineOnStorageSetEvent extends MachineCallbackArg {
  type: string;
  value: number;
}

/**
 * @beta
 */
export interface MachineDefinitionEvents {
  /**
   * Called after a UI button has been pressed.
   * @see {@link UiButtonElementDefinition}
   */
  onButtonPressed?: MachineEventCallback<MachineOnButtonPressedEventArg>;

  /**
   * Called after a network has completed sending machine storage allocations
   * contains information on each category sent in that pass with the starting and remaining budget.
   */
  onNetworkAllocationCompleted?: MachineEventCallback<NetworkStatsEventArg>;

  /**
   * Called after the machine's storage is set via setMachineStorage.
   */
  onStorageSet?: MachineEventCallback<MachineOnStorageSetEvent>;
}

/**
 * @beta
 */
export type MachineEventName = keyof MachineDefinitionEvents;

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
export interface MachineUpdateUiHandlerArg extends MachineCallbackArg {
  entityId: string;
}

/**
 * @beta
 */
export interface MachineUpdateUiHandlerResponse {
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
  updateUi?: MachineCallback<
    MachineUpdateUiHandlerArg,
    MachineUpdateUiHandlerResponse
  >;
  /**
   * Called before a machine recieves a storage type.
   * @returns a number that overrides the amount that was received
   * (must be a non-negative integer),
   * or `undefined` to not change anything.
   */
  receive?: MachineCallback<MachineRecieveHandlerArg, RecieveHandlerResponse>;
}

/**
 * @beta
 */
export type MachineHandlerName = keyof MachineDefinitionHandlers;

// registered machine

/**
 * @beta
 */
export type MachineCallbackName = MachineEventName | MachineHandlerName;

/**
 * @beta
 */
export interface MachineDefinition {
  description: MachineDefinitionDescription;
  handlers?: MachineDefinitionHandlers;
  events?: MachineDefinitionEvents;
}

export interface RecieveHandlerResponse {
  /**
   * Override the amount to recieve.
   */
  amount?: number;

  /**
   * Should the API handle setting machine storage?
   * - Note the API setting incurs a tick delay, for blocks where the tick order is important, this can help avoid race-conditions.
   *
   * @default true
   */
  handleStorage?: boolean;
}
