import { Vector3, DimensionLocation } from "@minecraft/server";
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
 * Converts a `DimensionLocation` to a human-readable string for debug output.
 * @internal
 * @param loc The `DimensionLocation` to stringify.
 */
export function stringifyDimensionLocation(loc: DimensionLocation): string {
  return `DimensionLocation {${loc.dimension.id} (${loc.x.toString()}, ${loc.y.toString()}, ${loc.z.toString()})}`;
}
