/**
 * Script for handling block destroy events for machines and conduits.
 * Destroy logic specific to conduits and machines can be found in their own files.
 */

import { world } from "@minecraft/server";
import { removeBlockFromScoreboards } from "./data";
import { MachineNetwork } from "./network";
import { logWarn } from "./utils/log";
import { InternalNetworkLinkNode } from "./network_links/network_link_internal";
import {
  getBlockNetworkConnectionType,
  NetworkConnectionType,
} from "@/public_api/src";
import { removeAllDynamicPropertiesForBlock } from "./utils/dynamic_property";

world.afterEvents.blockExplode.subscribe((e) => {
  const connectionType = getBlockNetworkConnectionType(
    e.explodedBlockPermutation,
  );
  if (!connectionType) {
    return;
  }

  removeAllDynamicPropertiesForBlock(e.block);
  MachineNetwork.updateWith(e.block, connectionType);

  if (connectionType === NetworkConnectionType.Machine) {
    removeBlockFromScoreboards(e.block);
  } else if (connectionType === NetworkConnectionType.NetworkLink) {
    const link = InternalNetworkLinkNode.tryGetAt(e.dimension, e.block);
    if (!link) {
      logWarn(
        "blockExplode after event - couldn't get InternalNetworkLinkNode",
      );
      return;
    }
    link.destroyNode();
  }
});
