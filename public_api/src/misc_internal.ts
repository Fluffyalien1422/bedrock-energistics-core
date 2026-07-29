import { Entity, Vector3, DimensionLocation } from "@minecraft/server";
import {
  VECTOR3_EAST,
  VECTOR3_WEST,
  VECTOR3_UP,
  VECTOR3_DOWN,
} from "@minecraft/math";

/**
 * @internal
 */
export const DIRECTION_VECTORS: Vector3[] = [
  { x: 0, y: 0, z: -1 },
  VECTOR3_EAST,
  { x: 0, y: 0, z: 1 },
  VECTOR3_WEST,
  VECTOR3_UP,
  VECTOR3_DOWN,
];

/**
 * Recursively freezes a value and everything it contains.
 * @internal
 * @remarks
 * Registration data nests arrays and objects (UI elements, default I/O,
 * texture descriptions), so a shallow freeze would leave those writable.
 */
export function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null) return value;

  for (const nested of Object.values(value)) {
    deepFreeze(nested);
  }

  return Object.freeze(value);
}

/**
 * Deep-copies a JSON-serializable value and freezes the copy.
 * @internal
 * @remarks
 * Used where an add-on hands us data that we keep. The copy means the add-on
 * can't change our state afterwards by mutating the object it passed us, and
 * the freeze means we can hand it back out without copying it again.
 *
 * Only safe for data that survives a JSON round-trip, which registration data
 * must anyway, since it is sent between packs.
 */
export function deepFreezeCopy<T>(value: T): T {
  return deepFreeze(JSON.parse(JSON.stringify(value)) as T);
}

/**
 * Finds the entity of a given type at a block location.
 * @internal
 * @remarks
 * Several things in this library are backed by an entity anchored to a block
 * (machine UI containers, network link nodes), which is how they are all
 * looked up.
 * @param location The block location to search.
 * @param entityTypeId The type ID of the entity to look for.
 * @returns The first matching entity, or `undefined` if there is none.
 */
export function findEntityAtBlockLocation(
  location: DimensionLocation,
  entityTypeId: string,
): Entity | undefined {
  return location.dimension
    .getEntitiesAtBlockLocation(location)
    .find((entity) => entity.typeId === entityTypeId);
}

/**
 * Converts a `DimensionLocation` to a human-readable string for debug output.
 * @internal
 * @param loc The `DimensionLocation` to stringify.
 */
export function stringifyDimensionLocation(loc: DimensionLocation): string {
  return `DimensionLocation {${loc.dimension.id} (${loc.x.toString()}, ${loc.y.toString()}, ${loc.z.toString()})}`;
}
