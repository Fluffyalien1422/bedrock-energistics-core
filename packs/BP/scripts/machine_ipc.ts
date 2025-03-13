import {
  deserializeDimensionLocation,
  SerializableDimensionLocation,
} from "@/public_api/src/serialize_utils";
import * as ipc from "mcbe-addon-ipc";
import { removeMachine } from "./machine";
import { InternalRegisteredMachine } from "./machine_registry";

export function removeMachineListener(payload: ipc.SerializableValue): null {
  const data = payload as SerializableDimensionLocation;

  const loc = deserializeDimensionLocation(data);
  const block = loc.dimension.getBlock(loc);
  if (!block) {
    throw new Error(`Expected a block at '${JSON.stringify(data)}'.`);
  }

  const def = InternalRegisteredMachine.forceGetInternal(block.typeId);

  removeMachine(block, def);

  return null;
}

