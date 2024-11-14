import {
  BlockCustomComponent,
  DimensionLocation,
  system,
  world,
} from "@minecraft/server";
import {
  getMachineSlotItem,
  machineItemStackToItemStack,
  removeBlockFromScoreboards,
} from "./data";
import { MachineNetwork } from "./network";
import { makeErrorString } from "./utils/log";
import { Vector3Utils } from "@minecraft/math";
import { RegisteredMachine } from "@/public_api/src";
import { getEntityComponent } from "./polyfills/component_type_map";
import {
  getMachineIdFromEntityId,
  InternalRegisteredMachine,
} from "./machine_registry";

export const machineNoInteractComponent: BlockCustomComponent = {
  onPlace(e) {
    if (e.block.typeId === e.previousBlock.type.id) return;
    MachineNetwork.updateAdjacent(e.block);

    const definition = InternalRegisteredMachine.getInternal(e.block.typeId);
    if (!definition) {
      throw new Error(
        makeErrorString(
          `can't process onPlace event for block '${e.block.typeId}': this block uses the 'fluffyalien_energisticscore:machine' custom component but it could not be found in the machine registry`,
        ),
      );
    }

    if (definition.persistentEntity) {
      const entity = e.block.dimension.spawnEntity(
        definition.entityId,
        e.block.bottomCenter(),
      );

      entity.nameTag = e.block.typeId;

      entity.setDynamicProperty("block_location", e.block.location);
    }
  },
};

export const machineComponent: BlockCustomComponent = {
  ...machineNoInteractComponent,
  onPlayerInteract(e) {
    const definition = InternalRegisteredMachine.getInternal(e.block.typeId);
    if (!definition) {
      throw new Error(
        makeErrorString(
          `can't process onPlayerInteract event for block '${e.block.typeId}': this block uses the 'fluffyalien_energisticscore:machine' custom component but it could not be found in the machine registry`,
        ),
      );
    }
    if (!definition.uiElements || definition.persistentEntity) {
      return;
    }

    const entity = e.block.dimension.spawnEntity(
      definition.entityId,
      e.block.bottomCenter(),
    );

    entity.nameTag = e.block.typeId;

    entity.setDynamicProperty("block_location", e.block.location);
  },
};

export function dropItemsStoredInMachine(
  blockLocation: DimensionLocation,
  definition: RegisteredMachine,
): void {
  if (!definition.uiElements) {
    return;
  }

  for (const element of Object.values(definition.uiElements)) {
    if (element.type !== "itemSlot") continue;

    const item = getMachineSlotItem(blockLocation, element.slotId);
    if (item) {
      blockLocation.dimension.spawnItem(
        machineItemStackToItemStack(element, item),
        Vector3Utils.add(blockLocation, { x: 0.5, y: 0.5, z: 0.5 }),
      );
    }
  }
}

world.beforeEvents.playerBreakBlock.subscribe((e) => {
  if (!e.block.hasTag("fluffyalien_energisticscore:machine")) {
    return;
  }

  const definition = InternalRegisteredMachine.getInternal(e.block.typeId);
  if (!definition) {
    throw new Error(
      makeErrorString(
        `can't process playerBreakBlock event for block '${e.block.typeId}': this block uses the 'fluffyalien_energisticscore:machine' custom component but it could not be found in the machine registry`,
      ),
    );
  }

  if (definition.persistentEntity) {
    return;
  }

  MachineNetwork.updateWithBlock(e.block);

  system.run(() => {
    dropItemsStoredInMachine(e.block, definition);
    removeBlockFromScoreboards(e.block);
  });
});

world.afterEvents.entityHitEntity.subscribe((e) => {
  if (
    e.damagingEntity.typeId !== "minecraft:player" ||
    !getEntityComponent(e.hitEntity, "type_family")?.hasTypeFamily(
      "fluffyalien_energisticscore:machine_entity",
    )
  ) {
    return;
  }

  const machineId = getMachineIdFromEntityId(e.hitEntity.typeId);
  if (!machineId) {
    throw new Error(
      makeErrorString(
        `can't process entityHitEntity event for machine entity '${e.hitEntity.typeId}': this entity has the 'fluffyalien_energisticscore:machine_entity' type family but it is not attached to a machine`,
      ),
    );
  }

  const definition = InternalRegisteredMachine.forceGetInternal(machineId);
  if (definition.persistentEntity) {
    return;
  }

  e.hitEntity.remove();
});
