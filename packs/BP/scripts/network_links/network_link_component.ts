/**
 * Network links connect two blocks that aren't physically adjacent, letting a
 * network span a gap. Each link block has a backing entity that stores its
 * linked positions (see network_link_internal.ts).
 */

import { BlockCustomComponent } from "@minecraft/server";
import { MachineNetwork } from "../network";
import {
  deserializeDimensionLocation,
  SerializableDimensionLocation,
} from "@/public_api/src/serialize_utils";
import { InternalNetworkLinkNode } from "./network_link_internal";
import { raisePublic } from "../log";
import { stringifyDimensionLocation } from "../utils/string";
import {
  getBlockNetworkConnectionType,
  PublicErrorType,
} from "@/public_api/src";

export const networkLinkComponent: BlockCustomComponent = {
  onPlace(ev) {
    MachineNetwork.updateAdjacent(ev.block);
  },

  onBreak(ev) {
    const linkNode = InternalNetworkLinkNode.tryGetAt(
      ev.dimension,
      ev.block.location,
    );

    // remove all incoming and outbound links to this node in the network
    if (linkNode) linkNode.destroyNode();

    // update the rest of the blocks in the network.
    MachineNetwork.updateWith(
      ev.block,
      getBlockNetworkConnectionType(ev.brokenBlockPermutation)!,
    );
  },
};

/**
 * Resolves a network link node from a serialized location sent over IPC.
 * Dependent add-ons manage links (add/remove/query connections) through the
 * public API, which routes to here.
 * @throws Throws a `PublicError` if the block isn't loaded, so the add-on that
 * made the call is told rather than the failure being logged here.
 */
export function getNetworkLinkNode(
  self: SerializableDimensionLocation,
): InternalNetworkLinkNode {
  const location = deserializeDimensionLocation(self);
  const block = location.dimension.getBlock(location);
  if (!block) {
    raisePublic(
      PublicErrorType.NotFound,
      `Failed to get the network link node at ${stringifyDimensionLocation(location)}. The block is not loaded.`,
    );
  }
  return InternalNetworkLinkNode.fromBlock(block);
}
