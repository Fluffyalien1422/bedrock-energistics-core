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
 * @param sendReserveStorage Should the amount in storage be included in the amount generated and sent to other machines on the network
 * @param consumeExisting When false the amount generated is added onto the machines current storage, when true, the amount generated is taken from existing storage
 * @see {@link queueSend}
 */
export function generate(
  blockLocation: DimensionLocation,
  type: string,
  amount: number,
  sendReserveStorage = true,
  consumeExisting = false,
): void {
  const payload: MangledGeneratePayload = {
    a: makeSerializableDimensionLocation(blockLocation),
    b: type,
    c: amount,
    d: sendReserveStorage,
    e: consumeExisting,
  };

  ipcSend("fluffyalien_energisticscore:ipc.generate", payload);
}
