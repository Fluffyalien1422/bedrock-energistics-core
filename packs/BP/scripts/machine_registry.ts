import * as ipc from "mcbe-addon-ipc";
import { DimensionLocation } from "@minecraft/server";
import { logInfo, makeErrorString, raise } from "./utils/log";
import {
  NetworkStorageTypeData,
  RegisteredMachine,
  UpdateUiHandlerResponse,
} from "@/public_api/src";
import {
  IpcNetworkStatsEventArg,
  MangledOnButtonPressedPayload,
  MangledRecieveHandlerPayload,
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
  ): Promise<UpdateUiHandlerResponse> {
    if (!this.data.updateUiEvent) {
      throw new Error(
        makeErrorString(
          "trying to call the 'updateUi' handler but it is not defined",
        ),
      );
    }

    return ipcInvoke(
      this.data.updateUiEvent,
      makeSerializableDimensionLocation(dimensionLocation),
    ) as Promise<UpdateUiHandlerResponse>;
  }

  invokeRecieveHandler(
    blockLocation: DimensionLocation,
    recieveType: string,
    recieveAmount: number,
  ): Promise<number> {
    if (!this.data.receiveHandlerEvent) {
      throw new Error(
        makeErrorString(
          "trying to call the 'recieve' handler but it is not defined",
        ),
      );
    }

    const payload: MangledRecieveHandlerPayload = {
      a: makeSerializableDimensionLocation(blockLocation),
      b: recieveType,
      c: recieveAmount,
    };

    return ipcInvoke(this.data.receiveHandlerEvent, payload) as Promise<number>;
  }

  callOnNetworkStatsRecievedEvent(
    dimensionLocation: DimensionLocation,
    data: Record<string, NetworkStorageTypeData>,
  ): void {
    if (!this.data.networkStatEvent)
      raise(
        `trying to call the 'onNetworkStatsRecievedEvent' handler but it is not defined.`,
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
      throw new Error(
        makeErrorString(
          "trying to call the 'onButtonPressed' event but it is not defined",
        ),
      );
    }

    const payload: MangledOnButtonPressedPayload = {
      a: makeSerializableDimensionLocation(blockLocation),
      b: playerId,
      c: entityId,
      d: buttonElementId,
    };

    ipcSend(this.data.onButtonPressedEvent, payload);
  }

  /**
   * @returns the `InternalRegisteredMachine` if it exists, otherwise `undefined`.
   */
  static getInternal(id: string): InternalRegisteredMachine | undefined {
    return machineRegistry.get(id);
  }

  /**
   *
   * @param id
   * @returns
   */
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
    throw new Error(
      makeErrorString(
        `can't register machine '${data.id}': the machine entity '${data.entityId}' is already attached to the machine '${entityExistingAttachment}'`,
      ),
    );
  }

  if (machineRegistry.has(data.id)) {
    logInfo(`overrode machine '${data.id}'`);
  }

  machineRegistry.set(data.id, data);
  machineEntityToBlockIdMap.set(data.entityId, data.id);

  return null;
}
