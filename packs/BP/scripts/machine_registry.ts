import * as ipc from "mcbe-addon-ipc";
import { DimensionLocation } from "@minecraft/server";
import { logWarn, raise } from "./utils/log";
import {
  MachineUpdateUiHandlerResponse,
  NetworkStorageTypeData,
  RecieveHandlerResponse,
  RegisteredMachine,
} from "@/public_api/src";
import {
  IpcMachineOnStorageSetEventArg,
  IpcMachineUpdateUiHandlerArg,
  IpcNetworkStatsEventArg,
  IpcOnButtonPressedPayload,
  IpcRecieveHandlerPayload,
  RegisteredMachineData,
} from "@/public_api/src/machine_registry_internal";
import { makeSerializableDimensionLocation } from "@/public_api/src/serialize_utils";
import { ipcInvoke, ipcSend } from "./ipc_wrapper";

const machineRegistry = new Map<string, InternalRegisteredMachine>();
const machineEntityToBlockIdMap = new Map<string, string>();

// @ts-expect-error extending private class for internal use
export class InternalRegisteredMachine extends RegisteredMachine {
  // override to make it public
  public constructor(data: RegisteredMachineData) {
    super(data);
  }

  getData(): RegisteredMachineData {
    return this.data;
  }

  invokeUpdateUiHandler(
    dimensionLocation: DimensionLocation,
    entityId: string,
  ): Promise<MachineUpdateUiHandlerResponse> {
    if (!this.data.updateUiEvent) {
      raise("Trying to call the 'updateUi' handler but it is not defined.");
    }

    const payload: IpcMachineUpdateUiHandlerArg = {
      blockLocation: makeSerializableDimensionLocation(dimensionLocation),
      entityId,
    };

    return ipcInvoke(
      this.data.updateUiEvent,
      payload,
    ) as Promise<MachineUpdateUiHandlerResponse>;
  }

  invokeReceiveHandler(
    blockLocation: DimensionLocation,
    recieveType: string,
    recieveAmount: number,
  ): Promise<RecieveHandlerResponse> {
    if (!this.data.receiveHandlerEvent) {
      raise("Trying to call the 'recieve' handler but it is not defined.");
    }

    const payload: IpcRecieveHandlerPayload = {
      blockLocation: makeSerializableDimensionLocation(blockLocation),
      recieveType,
      recieveAmount,
    };

    return ipcInvoke(
      this.data.receiveHandlerEvent,
      payload,
    ) as Promise<RecieveHandlerResponse>;
  }

  callOnNetworkAllocationCompletedEvent(
    dimensionLocation: DimensionLocation,
    data: Record<string, NetworkStorageTypeData>,
  ): void {
    if (!this.data.networkStatEvent)
      raise(
        "Trying to call the 'onNetworkAllocationCompleted' event but it is not defined.",
      );

    const payload: IpcNetworkStatsEventArg = {
      blockLocation: makeSerializableDimensionLocation(dimensionLocation),
      networkData: data,
    };

    ipcSend(this.data.networkStatEvent, payload);
  }

  callOnButtonPressedEvent(
    blockLocation: DimensionLocation,
    entityId: string,
    playerId: string,
    buttonElementId: string,
  ): void {
    if (!this.data.onButtonPressedEvent) {
      raise(
        "Trying to call the 'onButtonPressed' event but it is not defined.",
      );
    }

    const payload: IpcOnButtonPressedPayload = {
      blockLocation: makeSerializableDimensionLocation(blockLocation),
      playerId,
      entityId,
      elementId: buttonElementId,
    };

    ipcSend(this.data.onButtonPressedEvent, payload);
  }

  callOnStorageSetEvent(
    blockLocation: DimensionLocation,
    type: string,
    value: number,
  ): void {
    // There is a similar function to this in the public API.
    // Make sure changes are reflected in both.

    if (!this.data.onStorageSetEvent) {
      raise("Trying to call the 'onStorageSet' event but it is not defined.");
    }

    const payload: IpcMachineOnStorageSetEventArg = {
      blockLocation: makeSerializableDimensionLocation(blockLocation),
      type,
      value,
    };

    ipcSend(this.data.onStorageSetEvent, payload);
  }

  /**
   * @returns the `InternalRegisteredMachine` if it exists, otherwise `undefined`.
   */
  static getInternal(id: string): InternalRegisteredMachine | undefined {
    return machineRegistry.get(id);
  }

  static forceGetInternal(id: string): InternalRegisteredMachine {
    const registered = InternalRegisteredMachine.getInternal(id);
    if (!registered) {
      raise(
        `Expected '${id}' to be registered as a machine, but it could not be found in the machine registry.`,
      );
    }
    return registered;
  }
}

export function getMachineIdFromEntityId(entityId: string): string | undefined {
  return machineEntityToBlockIdMap.get(entityId);
}

export function registerMachineListener(payload: ipc.SerializableValue): null {
  const data = new InternalRegisteredMachine(payload as RegisteredMachineData);

  const entityExistingAttachment = machineEntityToBlockIdMap.get(data.entityId);
  if (entityExistingAttachment && entityExistingAttachment !== data.entityId) {
    raise(
      `Failed to register machine '${data.id}'. The attached machine entity '${data.entityId}' is already attached to the machine '${entityExistingAttachment}'.`,
    );
  }

  if (machineRegistry.has(data.id)) {
    logWarn(`Overrode machine '${data.id}'.`);
  }

  machineRegistry.set(data.id, data);
  machineEntityToBlockIdMap.set(data.entityId, data.id);

  return null;
}
