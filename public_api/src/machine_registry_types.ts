import { DimensionLocation } from "@minecraft/server";
import { BaseIpcCallback } from "./common_registry_types.js";
import {
  StorageTypeTextureDescription,
  StorageTypeTexturePreset,
} from "./storage_type_registry_types.js";
import { MachineNetwork } from "./network.js";

// -- ui --

/**
 * Dynamic configuration options for a storage bar UI element.
 * @beta
 * @see {@link MachineDefinitionHandlers.updateUi}.
 */
export interface UiStorageBarElementUpdateOptions {
  /**
   * The type of this storage bar. Set to "_disabled" to disable the storage bar.
   * @beta
   * @default "_disabled"
   */
  type?: string;
  /**
   * Use this property to override the label of the storage bar.
   * @beta
   */
  label?: string;
  /**
   * The max amount to display on this on storage bar. Defaults to {@link MachineDefinitionDescription.maxStorage}.
   * @beta
   */
  max?: number;
  /**
   * Use this property to override the {@link StorageTypeDefinition.texture} for this storage bar.
   * @beta
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
  /**
   * The starting slot index of this element in the JSON UI.
   * @beta
   */
  startIndex: number;
  /**
   * The amount of item slots to use.
   * @beta
   * @default 4
   */
  size?: number;
  /**
   * Default values to fill in any `undefined` values returned by `updateUi`.
   * @beta
   */
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
  /**
   * The slot index of this element in the JSON UI.
   * @beta
   */
  index: number;
  /**
   * Only allow specific items in this slot.
   * @beta
   */
  allowedItems?: string[];

  /**
   * The item ID to use when the slot is empty.
   * @beta
   * @default "fluffyalien_energisticscore:ui_empty_slot"
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
  /**
   * The indicator to display.
   * @beta
   */
  indicator: UiProgressIndicatorDescription | UiProgressIndicatorPreset;
  /**
   * The slot index of this element in the JSON UI.
   * @beta
   */
  index: number;
}

/**
 * Dynamic configuration options for a button UI element.
 * @beta
 * @see {@link MachineDefinitionHandlers.updateUi}.
 */
export interface UiButtonElementUpdateOptions {
  /**
   * The item to use as the button. This item must have the `fluffyalien_energisticscore:ui_item` tag.
   * @beta
   * @default "fluffyalien_energisticscore:ui_empty_slot"
   */
  itemId?: string;
  /**
   * The name tag for the item.
   * @beta
   */
  name?: string;
}

/**
 * Options for defining a button UI element.
 * @beta
 */
export interface UiButtonElementDefinition {
  type: "button";
  /**
   * The slot index of this element in the JSON UI.
   * @beta
   */
  index: number;
  /**
   * Default values to fill in any `undefined` values returned by `updateUi`.
   * @beta
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
 * Defines UI elements and their configuration for a machine.
 * @beta
 */
export interface UiOptions {
  elements: Record<string, UiElementDefinition>;
}

// -- end ui --

// -- description --

/**
 * Describes the core attributes of a machine.
 * @beta
 */
export interface MachineDefinitionDescription {
  /**
   * The ID of the machine block.
   * @beta
   */
  id: string;
  /**
   * The ID of the machine entity. Defaults to the value of `id`.
   * @beta
   */
  entityId?: string;
  /**
   * The name tag to give the machine entity when spawned. Defaults to the value of `id`.
   * @beta
   */
  defaultEntityNameTag?: string;
  /**
   * Is the machine entity persistent?
   * @beta
   * @remarks
   * See [Persistent Entities](https://fluffyalien1422.github.io/bedrock-energistics-core/api/documents/Guides.Persistent_Entities.html).
   */
  persistentEntity?: boolean;
  /**
   * Max amount of each storage type in this machine.
   * @beta
   * @default 6400
   */
  maxStorage?: number;
  /**
   * UI options for the machine.
   * @beta
   * @remarks
   * If this is `undefined`, then Bedrock Energistics Core will skip UI handling for this machine entity.
   */
  ui?: UiOptions;
}

// -- end description --

// -- common callback types --

/**
 * Base argument for machine callbacks.
 * @beta
 */
export interface MachineCallbackArg {
  /**
   * The dimension location of the machine.
   * @beta
   */
  blockLocation: DimensionLocation;
}

/**
 * Base type for machine callbacks.
 * @beta
 * @template TArg The argument type passed to the callback.
 * @template TReturn The return type of the callback.
 */
export type MachineCallback<
  TArg extends MachineCallbackArg,
  TReturn,
> = BaseIpcCallback<TArg, TReturn>;

// -- end common callback types --

// -- events --

/**
 * Base type for machine event callbacks.
 * @beta
 * @template TArg The argument type passed to the callback.
 */
export type MachineEventCallback<TArg extends MachineCallbackArg> =
  BaseIpcCallback<TArg, void>;

/**
 * Arguments for the `onButtonPressed` event callback.
 * @beta
 * @see {@link MachineDefinitionEvents.onButtonPressed}.
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
 * Arguments for the `onStorageSet` event callback.
 * @beta
 * @see {@link MachineDefinitionEvents.onStorageSet}.
 */
export interface MachineOnStorageSetEventArg extends MachineCallbackArg {
  /**
   * The storage type ID that was set.
   * @beta
   */
  type: string;
  /**
   * The new amount of this storage type.
   * @beta
   */
  value: number;
}

/**
 * Event callbacks for a machine.
 * @beta
 * @remarks
 * Events are called after a certain trigger has happened. Unlike handlers, these callbacks cannot modify what Bedrock Energistics Core does since they are called after the event has already occured.
 */
export interface MachineDefinitionEvents {
  /**
   * Called after a UI button has been pressed.
   * @beta
   * @see {@link UiButtonElementDefinition}.
   */
  onButtonPressed?: MachineEventCallback<MachineOnButtonPressedEventArg>;
  /**
   * Called after a network has completed sending machine storage allocations.
   * @beta
   */
  onNetworkAllocationCompleted?: MachineEventCallback<MachineNetworkStatsEventArg>;
  /**
   * Called after the machine's storage has been set via `setMachineStorage`.
   * @beta
   */
  onStorageSet?: MachineEventCallback<MachineOnStorageSetEventArg>;
}

/**
 * Union type of all machine event names.
 * @beta
 * @see {@link MachineDefinitionEvents}.
 */
export type MachineEventName = keyof MachineDefinitionEvents;

// -- end events --

// -- handlers --

/**
 * Arguments passed to the `receive` handler callback.
 * @see {@link MachineDefinitionHandlers.receive}.
 * @beta
 */
export interface MachineReceiveHandlerArg extends MachineCallbackArg {
  /**
   * The ID of the storage type being received.
   * @beta
   */
  receiveType: string;
  /**
   * The amount of the storage type being received.
   * @beta
   */
  receiveAmount: number;
}

/**
 * The return type of the `receive` handler callback.
 * @see {@link MachineDefinitionHandlers.receive}.
 * @beta
 */
export interface MachineReceiveHandlerRes {
  /**
   * Override the amount to receive.
   * @beta
   */
  amount?: number;

  /**
   * Should the API handle setting machine storage?
   * @beta
   * @remarks
   * Note that the API setting incurs a tick delay. For blocks where the tick order is important, this can help avoid race-conditions.
   * @default true
   */
  handleStorage?: boolean;
}

/**
 * Arguments passed to the `updateUi` handler callback.
 * @beta
 * @see {@link MachineDefinitionHandlers.updateUi}.
 */
export interface MachineUpdateUiHandlerArg extends MachineCallbackArg {
  /**
   * The ID of the machine entity whose UI is being updated.
   * @beta
   */
  entityId: string;
}

/**
 * The return type of the `updateUi` handler callback.
 * @beta
 * @remarks
 * Any `undefined` values will be filled with the values provided in the `defaults` property in the element definition (if applicable).
 * @see {@link MachineDefinitionHandlers.updateUi}.
 */
export interface MachineUpdateUiHandlerRes {
  /**
   * Updates for storage bar elements, keyed by element ID.
   * @beta
   */
  storageBars?: Record<string, UiStorageBarElementUpdateOptions>;
  /**
   * Updates for progress indicator elements, keyed by element ID. The value indicates the frame of the progress indicator.
   * @beta
   */
  progressIndicators?: Record<string, number>;
  /**
   * Updates for button elements, keyed by element ID.
   * @beta
   */
  buttons?: Record<string, UiButtonElementUpdateOptions>;
}

/**
 * Statistics about a storage type's availability on a network before and after distribution.
 * @beta
 * @see {@link MachineDefinitionEvents.onNetworkAllocationCompleted}.
 */
export interface NetworkStorageTypeData {
  /**
   * The amount of this storage type that was available on this network *before* distribution.
   * @beta
   */
  before: number;

  /**
   * The amount of this storage type that was available on this network *after* distribution.
   * @beta
   */
  after: number;
}

/**
 * Arguments passed to the `onNetworkAllocationCompleted` event callback.
 * @beta
 * @see {@link MachineDefinitionEvents.onNetworkAllocationCompleted}.
 */
export interface MachineNetworkStatsEventArg extends MachineCallbackArg {
  /**
   * The network that has triggered this event.
   * @beta
   */
  network: MachineNetwork;
  /**
   * Statistics about the network's storage type's availability on a network before and after distribution.
   * @beta
   */
  allocationData: NetworkStorageTypeData;
}

/**
 * Handler callbacks for a machine.
 * @beta
 * @remarks
 * Handlers are callbacks that respond to certain Bedrock Energistics Core events.
 * These callbacks return responses that tell Bedrock Energistics Core what to do.
 */
export interface MachineDefinitionHandlers {
  /**
   * Called during machine UI updates.
   * @beta
   * @remarks
   * This handler may be used to set any dynamic options for a machine UI.
   */
  updateUi?: MachineCallback<
    MachineUpdateUiHandlerArg,
    MachineUpdateUiHandlerRes
  >;
  /**
   * Called before a machine receives a storage type during allocation.
   * @beta
   * @remarks
   * This is called during allocation and may override the amount that the machine gets allocated.
   * This is not called when `setMachineStorage` is called.
   * Use {@link MachineDefinitionEvents.onStorageSet} for that event.
   */
  receive?: MachineCallback<MachineReceiveHandlerArg, MachineReceiveHandlerRes>;
}

/**
 * Union type of all machine handler names.
 * @beta
 * @see {@link MachineDefinitionHandlers}.
 */
export type MachineHandlerName = keyof MachineDefinitionHandlers;

// -- end handlers --

// -- registered machine --

/**
 * Union type of all machine callback names.
 * @beta
 * @see {@link MachineEventName}, {@link MachineDefinitionEvents}, {@link MachineHandlerName}, {@link MachineDefinitionHandlers}.
 */
export type MachineCallbackName = MachineEventName | MachineHandlerName;

/**
 * Complete machine definition.
 * @beta
 */
export interface MachineDefinition {
  /**
   * Describes the core attributes of the machine.
   * @beta
   */
  description: MachineDefinitionDescription;
  /**
   * Handler callbacks for the machine.
   * @beta
   * @remarks
   * Handlers are callbacks that respond to certain Bedrock Energistics Core events.
   * These callbacks return responses that tell Bedrock Energistics Core what to do.
   */
  handlers?: MachineDefinitionHandlers;
  /**
   * Event callbacks for the machine.
   * @beta
   * @remarks
   * Events are called after a certain trigger has happened. Unlike handlers, these callbacks cannot modify what Bedrock Energistics Core does since they are called after the event has already occured.
   */
  events?: MachineDefinitionEvents;
}

// -- end registered machine --
