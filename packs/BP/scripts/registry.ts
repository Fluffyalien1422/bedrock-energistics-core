import { Block, DimensionLocation, world } from "@minecraft/server";
import { logInfo, makeErrorString } from "./utils/log";
import {
  RegisteredMachine,
  StorageTypeDefinition,
  UpdateUiHandlerResponse,
} from "@/public_api/src";
import { dispatchScriptEvent, invokeScriptEvent } from "mcbe-addon-ipc";
import {
  makeSerializableDimensionLocation,
  MangledOnButtonPressedPayload,
  MangledRecieveHandlerPayload,
  MangledRegisteredMachine,
} from "@/public_api/src/internal";

export * from "@/public_api/src/registry_types";

export const machineRegistry: Record<string, InternalRegisteredMachine> = {};
export const machineEntityToBlockIdMap: Record<string, string> = {};
export const storageTypeRegistry: Record<string, StorageTypeDefinition> = {};

export class InternalRegisteredMachine extends RegisteredMachine {
  get updateUiEvent(): string | undefined {
    return this.internal.d;
  }

  get recieveHandlerEvent(): string | undefined {
    return this.internal.f;
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

    return invokeScriptEvent(
      this.updateUiEvent,
      "fluffyalien_energisticscore",
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

    return invokeScriptEvent(
      this.recieveHandlerEvent,
      "fluffyalien_energisticscore",
      payload,
    ) as Promise<number>;
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

    dispatchScriptEvent(this.onButtonPressedEvent, payload);
  }
}

// register energy by default
registerStorageTypeScriptEventListener({
  id: "energy",
  category: "energy",
  color: "yellow",
  name: "energy",
});

export function registerMachineScriptEventListener(
  mData: MangledRegisteredMachine,
): void {
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
}

export function registerStorageTypeScriptEventListener(
  data: StorageTypeDefinition,
): void {
  if (data.id in storageTypeRegistry) {
    logInfo(`overrode storage type '${data.id}'`);
  }

  storageTypeRegistry[data.id] = data;

  const objectiveId = `fluffyalien_energisticscore:storage${data.id}`;

  if (!world.scoreboard.getObjective(objectiveId)) {
    world.scoreboard.addObjective(objectiveId);
  }
}

/**
 *
 * @throws If its registered as a machine, but not found in the registry
 */
export function getMachineRegistration(
  block: Block,
): InternalRegisteredMachine {
  const registered = machineRegistry[block.typeId] as
    | InternalRegisteredMachine
    | undefined;

  if (!registered) {
    throw new Error(
      `expected block '${block.typeId}' to be in the machine registry, but it was not found!`,
    );
  }

  return registered;
}
