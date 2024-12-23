import { BlockCustomComponent, world } from "@minecraft/server";
import { MachineNetwork } from "./network";

export const conduitComponent: BlockCustomComponent = {
  onPlace(e) {
    if (e.block.typeId === e.previousBlock.type.id) return;

    MachineNetwork.updateAdjacent(e.block);
  },
};

world.beforeEvents.playerBreakBlock.subscribe((e) => {
  if (!e.block.hasTag("fluffyalien_energisticscore:conduit")) {
    return;
  }

  MachineNetwork.updateWithBlock(e.block);
});
