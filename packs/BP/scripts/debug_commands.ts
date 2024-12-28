import { ItemStack, system } from "@minecraft/server";

system.afterEvents.scriptEventReceive.subscribe(
  (e) => {
    if (!e.sourceEntity) return;

    if (e.id === "fluffyalien_energisticscore:debug.get_debug_stick") {
      e.sourceEntity.dimension.spawnItem(
        new ItemStack("fluffyalien_energisticscore:debug_stick"),
        e.sourceEntity.location,
      );
    }
  },
  {
    namespaces: ["fluffyalien_energisticscore"],
  },
);
