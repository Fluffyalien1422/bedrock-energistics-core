import {
  DimensionLocation,
  ScoreboardObjective,
  world,
} from "@minecraft/server";
import { SerializableDimensionLocation } from "./serialize_utils.js";
import { MachineItemStack } from "./machine_data.js";

/**
 * @internal
 */
export interface GetMachineSlotPayload {
  loc: SerializableDimensionLocation;
  slot: number;
}

/**
 * @internal
 */
export interface SetMachineSlotPayload extends GetMachineSlotPayload {
  item?: MachineItemStack;
}

/**
 * @internal
 */
export function getBlockUniqueId(loc: DimensionLocation): string {
  return (
    loc.dimension.id +
    Math.floor(loc.x).toString() +
    Math.floor(loc.y).toString() +
    Math.floor(loc.z).toString()
  );
}

/**
 * @internal
 */
export function getStorageScoreboardObjective(
  type: string,
): ScoreboardObjective | undefined {
  const id = `fluffyalien_energisticscore:storage${type}`;
  return world.scoreboard.getObjective(id);
}

/**
 * @internal
 */
export function getScore(
  objective: ScoreboardObjective,
  participant: string,
): number | undefined {
  if (!objective.hasParticipant(participant)) {
    return;
  }

  return objective.getScore(participant);
}
