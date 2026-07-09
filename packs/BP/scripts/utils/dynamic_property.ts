/**
 * Blocks have no dynamic-property storage of their own, so per-block data is
 * emulated with world dynamic properties. Each key is `_bdp<blockUid><id>`: the
 * `_bdp` prefix namespaces block data, the block uid ties it to a location, and
 * `<id>` is the caller's property name. This scheme also lets us enumerate or
 * wipe all properties for a block by prefix (see below).
 */

import { getBlockUniqueId } from "@/public_api/src/machine_data_internal";
import { DimensionLocation, Vector3, world } from "@minecraft/server";

export type DynamicPropertyValue = boolean | number | string | Vector3;

function makeBlockBaseDynamicPropertyId(loc: DimensionLocation): string {
  return "_bdp" + getBlockUniqueId(loc);
}

export function getBlockDynamicProperty(
  loc: DimensionLocation,
  id: string,
): DynamicPropertyValue | undefined {
  return world.getDynamicProperty(makeBlockBaseDynamicPropertyId(loc) + id);
}

export function setBlockDynamicProperty(
  loc: DimensionLocation,
  id: string,
  value?: DynamicPropertyValue,
): void {
  world.setDynamicProperty(makeBlockBaseDynamicPropertyId(loc) + id, value);
}

/** Lists the ids of all dynamic properties stored for a block. */
export function getBlockDynamicProperties(loc: DimensionLocation): string[] {
  const blockBaseId = makeBlockBaseDynamicPropertyId(loc);

  return world
    .getDynamicPropertyIds()
    .filter((id) => id.startsWith(blockBaseId))
    .map((id) => id.slice(blockBaseId.length));
}

/** Removes every dynamic property stored for a block (used on teardown). */
export function removeAllDynamicPropertiesForBlock(
  loc: DimensionLocation,
): void {
  const blockBaseId = makeBlockBaseDynamicPropertyId(loc);

  const properties = world
    .getDynamicPropertyIds()
    .filter((id) => id.startsWith(blockBaseId));

  for (const property of properties) {
    world.setDynamicProperty(property);
  }
}
