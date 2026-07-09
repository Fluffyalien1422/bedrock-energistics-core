/**
 * Conduits carry storage between machines but hold no state of their own, so
 * their only job is to trigger a network rebuild when placed or broken - adding
 * or removing a conduit can join or split networks.
 */

import { BlockCustomComponent } from "@minecraft/server";
import { MachineNetwork } from "./network";
import { NetworkConnectionType } from "@/public_api/src";

export const conduitComponent: BlockCustomComponent = {
  onPlace(e) {
    MachineNetwork.updateAdjacent(e.block);
  },
  onBreak(e) {
    MachineNetwork.updateWith(e.block, NetworkConnectionType.Conduit);
  },
};
