import { StorageTypeDefinition } from "./storage_type_registry_types.js";
import { registerStorageType } from "./storage_type_registry.js";
import { deepFreeze } from "./misc_internal.js";

/**
 * An enumeration of the standard storage type categories.
 * @beta
 */
export enum StandardStorageCategory {
  /**
   * A category for the `energy` storage type.
   */
  Energy = "energy",
  /**
   * A category for gaseous substances.
   */
  Gas = "gas",
  /**
   * A category for liquid substances.
   */
  Fluid = "fluid",
}

/**
 * An enumeration of the standard storage types.
 * @beta
 */
export enum StandardStorageType {
  Ammonia = "ammonia",
  Carbon = "carbon",
  Energy = "energy",
  Hydrogen = "hydrogen",
  Lava = "lava",
  LiquidExp = "liquid_exp",
  Nitrogen = "nitrogen",
  Oil = "oil",
  Oxygen = "oxygen",
  Steam = "steam",
  Water = "water",
}

/**
 * Definitions for all standard storage types.
 * @beta
 * @see {@link StandardStorageType}
 */
export const STANDARD_STORAGE_TYPE_DEFINITIONS: Readonly<
  Record<StandardStorageType, StorageTypeDefinition>
> = deepFreeze({
  ammonia: {
    category: StandardStorageCategory.Gas,
    texture: "ammonia",
    id: StandardStorageType.Ammonia,
    name: "ammonia",
  },
  carbon: {
    category: StandardStorageCategory.Gas,
    texture: "carbon",
    id: StandardStorageType.Carbon,
    name: "carbon",
  },
  energy: {
    category: StandardStorageCategory.Energy,
    texture: "energy",
    id: StandardStorageType.Energy,
    name: "energy",
  },
  hydrogen: {
    category: StandardStorageCategory.Gas,
    texture: "hydrogen",
    id: StandardStorageType.Hydrogen,
    name: "hydrogen",
  },
  lava: {
    category: StandardStorageCategory.Fluid,
    texture: "lava",
    id: StandardStorageType.Lava,
    name: "lava",
  },
  liquid_exp: {
    category: StandardStorageCategory.Fluid,
    texture: "liquid_exp",
    id: StandardStorageType.LiquidExp,
    name: "liquid experience",
  },
  nitrogen: {
    category: StandardStorageCategory.Gas,
    texture: "nitrogen",
    id: StandardStorageType.Nitrogen,
    name: "nitrogen",
  },
  oil: {
    category: StandardStorageCategory.Fluid,
    texture: "oil",
    id: StandardStorageType.Oil,
    name: "oil",
  },
  oxygen: {
    category: StandardStorageCategory.Gas,
    texture: "oxygen",
    id: StandardStorageType.Oxygen,
    name: "oxygen",
  },
  steam: {
    category: StandardStorageCategory.Gas,
    texture: "steam",
    id: StandardStorageType.Steam,
    name: "steam",
  },
  water: {
    category: StandardStorageCategory.Fluid,
    texture: "water",
    id: StandardStorageType.Water,
    name: "water",
  },
});

/**
 * Register a standard storage type for use in your add-on.
 * @beta
 * @remarks
 * This is a wrapper around {@link registerStorageType} that uses
 * the definitions defined in {@link STANDARD_STORAGE_TYPE_DEFINITIONS}.
 * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidState} if registration has been closed, or if this package has not been initialized (see {@link init}).
 */
export function useStandardStorageType(id: StandardStorageType): void {
  registerStorageType(STANDARD_STORAGE_TYPE_DEFINITIONS[id]);
}
