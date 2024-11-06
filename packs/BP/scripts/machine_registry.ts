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
  MangledRegisteredMachine,
} from "@/public_api/src/machine_registry_internal";
import { makeSerializableDimensionLocation } from "@/public_api/src/serialize_utils";
import { ipcInvoke, ipcSend } from "./ipc_wrapper";

export const machineRegistry: Record<string, InternalRegisteredMachine> = {};
export const machineEntityToBlockIdMap: Record<string, string> = {};

export class InternalRegisteredMachine extends RegisteredMachine {
  get mangled(): MangledRegisteredMachine {
    return this.internal;
  }

  get updateUiEvent(): string | undefined {
    return this.internal.d;
  }

  get recieveHandlerEvent(): string | undefined {
    return this.internal.f;
  }

  get onNetworkStatsRecievedEvent(): string | undefined {
    return this.internal.i;
  }

  get onButtonPressedEvent(): string | undefined {
    return this.internal.h;
  }

  invokeUpdateUiHandler(
    dimensionLocation: DimensionLocation,
  ): Promise<UpdateUiHandlerResponse> {
    if (!this.updateUiEvent) {
      throw new Error(
        makeErrorString(
          "trying to call the 'updateUi' handler but it is not defined",
        ),
      );
    }

    return ipcInvoke(
      this.updateUiEvent,
      makeSerializableDimensionLocation(dimensionLocation),
    ) as Promise<UpdateUiHandlerResponse>;
  }

  invokeRecieveHandler(
    blockLocation: DimensionLocation,
    recieveType: string,
    recieveAmount: number,
  ): Promise<number> {
    if (!this.recieveHandlerEvent) {
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

    return ipcInvoke(this.recieveHandlerEvent, payload) as Promise<number>;
  }

  callOnNetworkStatsRecievedEvent(
    dimensionLocation: DimensionLocation,
    data: Record<string, NetworkStorageTypeData>,
  ): void {
    if (!this.onNetworkStatsRecievedEvent)
      raise(
        `trying to call the 'onNetworkStatsRecievedEvent' handler but it is not defined.`,
      );

    const payload: IpcNetworkStatsEventArg = {
      blockLocation: makeSerializableDimensionLocation(dimensionLocation),
      networkData: data,
    };

    ipcSend(this.onNetworkStatsRecievedEvent, payload);
  }

  callOnButtonPressedEvent(
    blockLocation: DimensionLocation,
    entityId: string,
    playerId: string,
    buttonElementId: string,
  ): void {
    if (!this.onButtonPressedEvent) {
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

    ipcSend(this.onButtonPressedEvent, payload);
  }

  /**
   * @returns the `InternalRegisteredMachine` if it exists, otherwise `undefined`.
   */
  static getInternal(id: string): InternalRegisteredMachine | undefined {
    return machineRegistry[id];
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
  return machineEntityToBlockIdMap[entityId];
}

export function registerMachineListener(payload: ipc.SerializableValue): null {
  const mData = payload as MangledRegisteredMachine;
  const data = new InternalRegisteredMachine(mData);

  const entityExistingAttachment = machineEntityToBlockIdMap[data.entityId];
  if (entityExistingAttachment && entityExistingAttachment !== data.id) {
    throw new Error(
      makeErrorString(
        `can't register machine '${data.id}': the machine entity '${data.entityId}' is already attached to the machine '${entityExistingAttachment}'`,
      ),
    );
  }

  if (data.id in machineRegistry) {
    logInfo(`overrode machine '${data.id}'`);
  }

  machineRegistry[data.id] = data;
  machineEntityToBlockIdMap[data.entityId] = data.id;

  return null;
}
