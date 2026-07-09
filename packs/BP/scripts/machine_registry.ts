import * as ipc from "mcbe-addon-ipc";
import { DimensionLocation } from "@minecraft/server";
import { logWarn, raise } from "./utils/log";
import {
  MachineUpdateUiHandlerRes,
  NetworkStorageTypeData,
  MachineReceiveHandlerRes,
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
import { MachineNetwork } from "./network";
import { createNetworkDataPayload } from "./network_ipc";

const machineRegistry = new Map<string, InternalRegisteredMachine>();
// Maps a machine's UI-entity type id back to its block type id, so entity
// events (container opened, hit, etc.) can resolve the owning machine.
const machineEntityToBlockIdMap = new Map<string, string>();

/**
 * Core-side view of a registered machine. Extends the public {@link
 * RegisteredMachine} to expose its internal data and to add the "invoke"/"call"
 * helpers that dispatch a machine's event handlers back to the add-on that
 * registered them, over IPC.
 * @remarks
 * "invoke" helpers expect a response (request/response); "call" helpers are
 * fire-and-forget notifications. A handler only exists on the owning add-on's
 * side, hence the IPC hop.
 */
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
  ): Promise<MachineUpdateUiHandlerRes> {
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
    ) as Promise<MachineUpdateUiHandlerRes>;
  }

  invokeRecieveHandler(
    blockLocation: DimensionLocation,
    recieveType: string,
    recieveAmount: number,
  ): Promise<MachineReceiveHandlerRes> {
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
    ) as Promise<MachineReceiveHandlerRes>;
  }

  callOnNetworkAllocationCompletedEvent(
    dimensionLocation: DimensionLocation,
    network: MachineNetwork,
    data: NetworkStorageTypeData,
  ): void {
    if (!this.data.networkStatEvent)
      raise(
        "Trying to call the 'onNetworkAllocationCompleted' event but it is not defined.",
      );

    const payload: IpcNetworkStatsEventArg = {
      blockLocation: makeSerializableDimensionLocation(dimensionLocation),
      network: createNetworkDataPayload(network),
      allocationData: data,
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

  /**
   * Like {@link InternalRegisteredMachine.getInternal} but throws instead of
   * returning `undefined`. Use when the machine is expected to exist (e.g. in a
   * block event for a machine block) and a missing entry is a bug.
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

/**
 * Resolves a machine's UI-entity type id to its block type id, or `undefined`
 * if the entity isn't a registered machine entity.
 */
export function getMachineIdFromEntityId(entityId: string): string | undefined {
  return machineEntityToBlockIdMap.get(entityId);
}

/**
 * IPC listener that registers (or overrides) a machine. Invoked when a
 * dependent add-on calls the public registration API. Populates both the
 * machine registry and the entity-to-block lookup.
 */
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
