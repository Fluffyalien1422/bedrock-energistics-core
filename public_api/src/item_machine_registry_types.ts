import {
  BlockInventoryComponent,
  EntityInventoryComponent,
} from "@minecraft/server";

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
   * Use the item lore to display the amount of each storage type.
   * @default true
   */
  loreDisplay?: boolean;
}

// common callback types

/**
 * @beta
 */
export interface ItemMachineCallbackArg {
  inventory: BlockInventoryComponent | EntityInventoryComponent;
  slot: number;
}

/**
 * @beta
 */
export type ItemMachineCallback<
  TArg extends ItemMachineCallbackArg,
  TReturn,
> = (this: null, arg: TArg) => TReturn;

// handlers

/**
 * @beta
 */
export interface ItemMachineGetIoResponse {
  categories: string[];
  types: string[];
}

/**
 * @beta
 */
export interface ItemMachineHandlers {
  getIo?: ItemMachineCallback<ItemMachineCallbackArg, ItemMachineGetIoResponse>;
}

// definition

/**
 * @beta
 */
export interface ItemMachineDefinition {
  description: ItemMachineDefinitionDescription;
  handlers?: ItemMachineHandlers;
}
