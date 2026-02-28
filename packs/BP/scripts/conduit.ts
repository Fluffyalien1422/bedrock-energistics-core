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
