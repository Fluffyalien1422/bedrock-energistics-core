import {
  BlockComponentTypes,
  BlockInventoryComponent,
  ContainerSlot,
  DimensionLocation,
  EntityComponentTypes,
  EntityInventoryComponent,
  Vector3,
  world,
} from "@minecraft/server";
import { raise } from "./log.js";
import { stringifyDimensionLocation } from "./misc_internal.js";

/**
 * @internal
 */
export interface SerializableDimensionLocation extends Vector3 {
  /**
   * dimension id
   */
  d: string;
}

/**
 * @internal
 */
export function makeSerializableDimensionLocation(
  loc: DimensionLocation,
): SerializableDimensionLocation {
  return {
    d: loc.dimension.id,
    x: loc.x,
    y: loc.y,
    z: loc.z,
  };
}

/**
 * @internal
 */
export function deserializeDimensionLocation(
  loc: SerializableDimensionLocation,
): DimensionLocation {
  return {
    dimension: world.getDimension(loc.d),
    x: loc.x,
    y: loc.y,
    z: loc.z,
  };
}

/**
 * @internal
 */
export enum SerializableContainerSlotActorType {
  Entity,
  Block,
}

/**
 * @internal
 */
export interface SerializableContainerSlotJson {
  slot: number;
  actor:
    | {
        type: SerializableContainerSlotActorType.Block;
        loc: SerializableDimensionLocation;
      }
    | {
        type: SerializableContainerSlotActorType.Entity;
        id: string;
      };
}

/**
 * @internal
 */
export class SerializableContainerSlot {
  constructor(
    readonly inventory: BlockInventoryComponent | EntityInventoryComponent,
    readonly slot: number,
  ) {}

  toContainerSlot(): ContainerSlot {
    if (!this.inventory.container) {
      raise("This inventory is no longer valid.");
    }

    return this.inventory.container.getSlot(this.slot);
  }

  toJson(): SerializableContainerSlotJson {
    if (this.inventory instanceof BlockInventoryComponent) {
      return {
        slot: this.slot,
        actor: {
          type: SerializableContainerSlotActorType.Block,
          loc: makeSerializableDimensionLocation(this.inventory.block),
        },
      };
    }

    return {
      slot: this.slot,
      actor: {
        type: SerializableContainerSlotActorType.Entity,
        id: this.inventory.entity.id,
      },
    };
  }

  static fromJson(
    obj: SerializableContainerSlotJson,
  ): SerializableContainerSlot {
    if (obj.actor.type === SerializableContainerSlotActorType.Block) {
      const loc = deserializeDimensionLocation(obj.actor.loc);
      const block = loc.dimension.getBlock(loc);
      if (!block) {
        raise(`Could not get block at ${stringifyDimensionLocation(loc)}.`);
      }

      const inv = block.getComponent(BlockComponentTypes.Inventory)!;

      return new SerializableContainerSlot(inv, obj.slot);
    }

    const entity = world.getEntity(obj.actor.id);
    if (!entity) {
      raise(`Could not get entity with ID '${obj.actor.id}'.`);
    }

    const inv = entity.getComponent(EntityComponentTypes.Inventory)!;

    return new SerializableContainerSlot(inv, obj.slot);
  }
}
