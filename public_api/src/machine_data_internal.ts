import {
  DimensionLocation,
  ScoreboardObjective,
  world,
} from "@minecraft/server";
import { SerializableDimensionLocation } from "./serialize_utils.js";
import { NetworkConnectionType } from "./network_utils.js";

/**
 * @internal
 */
export interface GetMachineSlotPayload {
  loc: SerializableDimensionLocation;
  slot: string;
}

/**
 * @internal
 */
export interface SetMachineSlotPayload extends GetMachineSlotPayload {
  item?: string;
}

/**
 * @internal
 */
export interface RemoveMachineDataPayload {
  loc: SerializableDimensionLocation;
  connectionType: NetworkConnectionType;
}

/**
 * @internal
 */
export function getBlockUniqueId(loc: DimensionLocation): string {
  return (
    Math.floor(loc.x).toString() +
    "," +
    Math.floor(loc.y).toString() +
    "," +
    Math.floor(loc.z).toString() +
    "," +
    loc.dimension.id
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
