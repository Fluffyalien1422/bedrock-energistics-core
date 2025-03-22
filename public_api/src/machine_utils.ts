import { DimensionLocation } from "@minecraft/server";
import { ipcInvoke } from "./ipc_wrapper.js";
import { BecIpcListener } from "./bec_ipc_listener.js";
import { makeSerializableDimensionLocation } from "./serialize_utils.js";

/**
 * Cleans up machine data and updates it's networks.
 * @beta
 * @remarks
 * This is automatically done by Bedrock Energistics Core when a machine is destroyed by a player.
 * If you destroy a machine from script, call this function before the block is removed.
 * @param loc The machine block location.
 */
export async function removeMachine(loc: DimensionLocation): Promise<void> {
  await ipcInvoke(
    BecIpcListener.RemoveMachine,
    makeSerializableDimensionLocation(loc),
  );
}
