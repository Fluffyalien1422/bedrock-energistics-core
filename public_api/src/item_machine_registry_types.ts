import { ItemMachine } from "./item_machine.js";

/**
 * @beta
 */
export interface ItemMachineDefinitionDescription {
  id: string;
  /**
   * Max amount of each storage type in this machine.
   * @default 6400
   */
  maxStorage?: number;
  /**
   * Default I/O for the item machine. This is used to fill in any `undefined` values returned by `getIo`.
   */
  defaultIo?: ItemMachineGetIoResponse;
}

// common callback types

/**
 * @beta
 */
export interface ItemMachineCallbackArg {
  itemMachine: ItemMachine;
}

/**
 * @beta
 */
export type ItemMachineCallback<
  TArg extends ItemMachineCallbackArg,
  TReturn,
> = (this: null, arg: TArg) => TReturn;

/**
 * @beta
 */
export type ItemMachineEventCallback<T extends ItemMachineCallbackArg> =
  ItemMachineCallback<T, void>;

// handlers

/**
 * @beta
 */
export interface ItemMachineGetIoResponse {
  /**
   * Accept any storage type. If this is `true`, `categories` and `types` are ignored.
   */
  acceptsAny?: boolean;
  /**
   * Accepted storage type categories.
   */
  categories?: string[];
  /**
   * Accepted storage types.
   */
  types?: string[];
}

/**
 * @beta
 */
export interface ItemMachineDefinitionHandlers {
  getIo?: ItemMachineCallback<ItemMachineCallbackArg, ItemMachineGetIoResponse>;
}

// events

export interface ItemMachineOnStorageSetArg extends ItemMachineCallbackArg {
  type: string;
  value: number;
}

/**
 * @beta
 */
export interface ItemMachineDefinitionEvents {
  onStorageSet?: ItemMachineEventCallback<ItemMachineOnStorageSetArg>;
}

// definition

/**
 * @beta
 */
export interface ItemMachineDefinition {
  description: ItemMachineDefinitionDescription;
  handlers?: ItemMachineDefinitionHandlers;
  events?: ItemMachineDefinitionEvents;
}
