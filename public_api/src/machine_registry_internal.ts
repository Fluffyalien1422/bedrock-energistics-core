import { DimensionLocation } from "@minecraft/server";
import {
  NetworkStorageTypeData,
  UiElementDefinition,
} from "./machine_registry_types.js";
import {
  makeSerializableDimensionLocation,
  SerializableDimensionLocation,
} from "./serialize_utils.js";
import { raise } from "./log.js";
import { RegisteredMachine } from "./machine_registry.js";
import { ipcSendAny } from "./ipc_wrapper.js";

/**
 * @internal
 */
export interface RegisteredMachineData {
  // definition
  id: string;
  entityId?: string;
  persistentEntity?: boolean;
  maxStorage?: number;
  uiElements?: Record<string, UiElementDefinition>;
  // script events
  updateUiEvent?: string;
  receiveHandlerEvent?: string;
  onButtonPressedEvent?: string;
  networkStatEvent?: string;
  onStorageSetEvent?: string;
}

/**
 * @internal
 */
export interface IpcMachineCallbackArg {
  blockLocation: SerializableDimensionLocation;
}

/**
 * @internal
 */
export interface IpcRecieveHandlerPayload extends IpcMachineCallbackArg {
  recieveType: string;
  recieveAmount: number;
}

/**
 * @internal
 */
export interface IpcOnButtonPressedPayload extends IpcMachineCallbackArg {
  playerId: string;
  entityId: string;
  elementId: string;
}

/**
 * @internal
 */
export interface IpcNetworkStatsEventArg extends IpcMachineCallbackArg {
  networkData: NetworkStorageTypeData;
}

/**
 * @internal
 */
export interface IpcMachineUpdateUiHandlerArg extends IpcMachineCallbackArg {
  entityId: string;
}

/**
 * @internal
 */
export interface IpcMachineOnStorageSetEventArg extends IpcMachineCallbackArg {
  type: string;
  value: number;
}

/**
 * @internal
 */
export function callMachineOnStorageSetEvent(
  registeredMachine: RegisteredMachine,
  blockLocation: DimensionLocation,
  type: string,
  value: number,
): void {
  // There is a similar function to this in the add-on.
  // Make sure changes are reflected in both.

  // @ts-expect-error internal functions are allowed to access internal properties
  const data = registeredMachine.data;

  if (!data.onStorageSetEvent) {
    raise("Trying to call the 'onStorageSet' event but it is not defined.");
  }

  const payload: IpcMachineOnStorageSetEventArg = {
    blockLocation: makeSerializableDimensionLocation(blockLocation),
    type,
    value,
  };

  ipcSendAny(data.onStorageSetEvent, payload);
}
