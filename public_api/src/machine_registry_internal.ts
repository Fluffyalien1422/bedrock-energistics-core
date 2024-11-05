import { NetworkStorageTypeData, UiElement } from "./registry_types.js";
import { SerializableDimensionLocation } from "./serialize_utils.js";

export interface MangledRegisteredMachine {
  /**
   * description.id
   */
  a: string;
  /**
   * description.persistentEntity
   */
  b?: boolean;
  /**
   * description.ui.elements
   */
  c?: Record<string, UiElement>;
  /**
   * updateUiEvent
   */
  d?: string;
  /**
   * description.entityId
   */
  e?: string;
  /**
   * receiveHandlerEvent
   */
  f?: string;
  /**
   * description.maxStorage
   */
  g?: number;
  /**
   * onButtonPressedEvent
   */
  h?: string;
  /**
   * networkStatEvent
   */
  i?: string;
}

export interface MangledRecieveHandlerPayload {
  /**
   * blockLocation
   */
  a: SerializableDimensionLocation;
  /**
   * recieveType
   */
  b: string;
  /**
   * recieveAmount
   */
  c: number;
}

export interface MangledOnButtonPressedPayload {
  /**
   * blockLocation
   */
  a: SerializableDimensionLocation;
  /**
   * playerId
   */
  b: string;
  /**
   * entityId
   */
  c: string;
  /**
   * elementId
   */
  d: string;
}

export interface IpcNetworkStatsEventArg {
  networkData: Record<string, NetworkStorageTypeData>;
  blockLocation: SerializableDimensionLocation;
}
