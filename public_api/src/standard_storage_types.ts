import { StorageTypeDefinition } from "./storage_type_registry_types.js";
import { registerStorageType } from "./storage_type_registry.js";

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
  Energy = "energy",
  Lava = "lava",
  /**
   * Ammonia in it's liquid form. {@link StandardStorageType.Ammonia} refers to the gaseous form of ammonia.
   */
  LiquidAmmonia = "liquid_ammonia",
  /**
   * Petroleum or crude oil.
   */
  Oil = "oil",
  Water = "water",
  /**
   * Ammonia in it's gaseous form. {@link StandardStorageType.LiquidAmmonia} refers to the liquid form of ammonia.
   */
  Ammonia = "ammonia",
  /**
   * Carbon dioxide.
   */
  Carbon = "carbon",
  Hydrogen = "hydrogen",
  Nitrogen = "nitrogen",
  Oxygen = "oxygen",
  /**
   * Water vapor.
   */
  Steam = "steam",
}

/**
 * Definitions for all standard storage types.
 * @beta
 * @see {@link StandardStorageType}
 */
export const STANDARD_STORAGE_TYPE_DEFINITIONS: Record<
  StandardStorageType,
  StorageTypeDefinition
> = {
  energy: {
    category: StandardStorageCategory.Energy,
    color: "yellow",
    id: StandardStorageType.Energy,
    name: "energy",
  },
  lava: {
    category: StandardStorageCategory.Fluid,
    color: "red",
    id: StandardStorageType.Lava,
    name: "lava",
  },
  liquid_ammonia: {
    category: StandardStorageCategory.Fluid,
    color: "orange",
    id: StandardStorageType.LiquidAmmonia,
    name: "liquid ammonia",
  },
  oil: {
    category: StandardStorageCategory.Fluid,
    color: "black",
    id: StandardStorageType.Oil,
    name: "oil",
  },
  water: {
    category: StandardStorageCategory.Fluid,
    color: "blue",
    id: StandardStorageType.Water,
    name: "water",
  },
  ammonia: {
    category: StandardStorageCategory.Gas,
    color: "orange",
    id: StandardStorageType.Ammonia,
    name: "ammonia",
  },
  carbon: {
    category: StandardStorageCategory.Gas,
    color: "red",
    id: StandardStorageType.Carbon,
    name: "carbon",
  },
  hydrogen: {
    category: StandardStorageCategory.Gas,
    color: "pink",
    id: StandardStorageType.Hydrogen,
    name: "hydrogen",
  },
  nitrogen: {
    category: StandardStorageCategory.Gas,
    color: "purple",
    id: StandardStorageType.Nitrogen,
    name: "nitrogen",
  },
  oxygen: {
    category: StandardStorageCategory.Gas,
    color: "white",
    id: StandardStorageType.Oxygen,
    name: "oxygen",
  },
  steam: {
    category: StandardStorageCategory.Gas,
    color: "white",
    id: StandardStorageType.Steam,
    name: "steam",
  },
};

/**
 * Register a standard storage type for use in your add-on.
 * @beta
 * @remarks
 * This is a wrapper around {@link registerStorageType} that uses
 * the definitions defined in {@link STANDARD_STORAGE_TYPE_DEFINITIONS}.
 */
export function useStandardStorageType(id: StandardStorageType): void {
  registerStorageType(STANDARD_STORAGE_TYPE_DEFINITIONS[id]);
}
