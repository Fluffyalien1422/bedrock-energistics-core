import { world } from "@minecraft/server";
import { machineComponent, machineNoInteractComponent } from "./machine";
import { conduitComponent } from "./conduit";
import { networkLinkComponent } from "./network_links/network_link_component";

world.beforeEvents.worldInitialize.subscribe((e) => {
  e.blockComponentRegistry.registerCustomComponent(
    "fluffyalien_energisticscore:machine",
    machineComponent,
  );

  e.blockComponentRegistry.registerCustomComponent(
    "fluffyalien_energisticscore:machine_no_interact",
    machineNoInteractComponent,
  );

  e.blockComponentRegistry.registerCustomComponent(
    "fluffyalien_energisticscore:conduit",
    conduitComponent,
  );

  e.blockComponentRegistry.registerCustomComponent(
    "fluffyalien_energisticscore:network_link",
    networkLinkComponent,
  );
});
