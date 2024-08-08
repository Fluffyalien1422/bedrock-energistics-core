import { DimensionLocation } from "@minecraft/server";

// ui
export type UiProgressIndicatorElementType = "arrow";

export interface UiStorageBarElement {
  type: "storageBar";
  startIndex: number;
}

export interface UiItemSlotElement {
  type: "itemSlot";
  index: number;
  slotId: number;
  allowedItems: string[];
}

export interface UiProgressIndicatorElement {
  type: "progressIndicator";
  indicator: UiProgressIndicatorElementType;
  index: number;
}

export type UiElement =
  | UiStorageBarElement
  | UiItemSlotElement
  | UiProgressIndicatorElement;

export interface UiOptions {
  elements: Record<string, UiElement>;
}

export interface Description {
  id: string;
  ui?: UiOptions;
}

// handlers
export interface UiElementUpdateOptions {
  element: string;
}

export interface UiStorageBarUpdateOptions extends UiElementUpdateOptions {
  /**
   * The type of this storage bar. Set to "_disabled" to disable the storage bar.
   */
  type: string;
  change: number;
}

export interface UpdateUiHandlerResponse {
  storageBars?: UiStorageBarUpdateOptions[];
  progressIndicators?: Record<string, number>;
}

export interface Handlers {
  updateUi?(blockLocation: DimensionLocation): UpdateUiHandlerResponse;
}

// registered machine
export interface MachineDefinition {
  description: Description;
  handlers?: Handlers;
}

// storage type options
export type StorageTypeColor =
  | "black"
  | "orange"
  | "pink"
  | "purple"
  | "red"
  | "yellow";

export interface StorageTypeDefinition {
  id: string;
  color: StorageTypeColor;
  name: string;
}
