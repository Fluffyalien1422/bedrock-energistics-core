import { Block, BlockPermutation, DimensionLocation } from "@minecraft/server";
import { MangledGeneratePayload } from "./network_internal.js";
import { makeSerializableDimensionLocation } from "./serialize_utils.js";
import { ipcSend } from "./ipc_wrapper.js";

export enum NetworkConnectionType {
  Conduit = "Conduit",
  Machine = "Machine",
  NetworkLink = "NetworkLink",
}

export function getBlockNetworkConnectionType(
  block: Block | BlockPermutation,
): NetworkConnectionType | null {
  if (block.hasTag("fluffyalien_energisticscore:conduit"))
    return NetworkConnectionType.Conduit;
  if (block.hasTag("fluffyalien_energisticscore:machine"))
    return NetworkConnectionType.Machine;
  if (block.hasTag("fluffyalien_energisticscore:network_link"))
    return NetworkConnectionType.NetworkLink;
  return null;
}

export enum GenerateMode {
  /**
   * - Sends existing reserve storage
   * - Adds the amount generated ontop of existing reserve
   */
  Default,

  /**
   * - Only sends the amount passed in generate, does not include reserve
   * - Takes the amount away from existing reserve
   */
  TakeFromReserve,
}

/**
 * Sends a storage type over a machine network. Includes reserve storage as well (if `sendReserveStorage` is true).
 * @beta
 * @remarks
 * This function should be called every block tick for generators even if the generation is `0` because it sends reserve storage (if `sendReserveStorage` is true).
 * Automatically sets the machine's reserve storage to the amount that was not received.
 * This function is a wrapper around {@link MachineNetwork.queueSend}.
 * @param blockLocation The location of the machine that is generating.
 * @param type The storage type to generate.
 * @param amount The amount to generate.
 * @param mode What mode should generate use?
 * @see {@link queueSend}
 */
export function generate(
  blockLocation: DimensionLocation,
  type: string,
  amount: number,
  mode: GenerateMode = GenerateMode.Default,
): void {
  const payload: MangledGeneratePayload = {
    a: makeSerializableDimensionLocation(blockLocation),
    b: type,
    c: amount,
    d: mode,
  };

  ipcSend("fluffyalien_energisticscore:ipc.generate", payload);
}
