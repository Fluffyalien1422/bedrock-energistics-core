import {
  Block,
  DimensionLocation,
  ScoreboardObjective,
  world,
} from "@minecraft/server";
import { SerializableDimensionLocation } from "./serialize_utils.js";
import { NetworkConnectionType } from "./network_utils.js";
import { logWarn, raisePublic } from "./log.js";
import { PublicErrorType } from "./error.js";

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
 * Validates the arguments of a machine storage write and resolves the
 * scoreboard objective the value belongs in.
 * @internal
 * @remarks
 * Shared by the add-on and the public API. They implement the rest of the write
 * separately, because one resolves the machine synchronously from its own
 * registry while the other has to fetch it over IPC, but the checks and the
 * order they happen in must stay identical.
 * @throws Throws a {@link PublicError} if the block is invalid, the value is
 * negative, or the storage type does not exist.
 */
export function resolveMachineStorageWrite(
  block: Block,
  type: string,
  value: number,
): ScoreboardObjective {
  if (!block.isValid) {
    raisePublic(
      PublicErrorType.InvalidObject,
      "Failed to set machine storage. The block is invalid.",
    );
  }

  if (value < 0) {
    raisePublic(
      PublicErrorType.InvalidArgument,
      `Failed to set machine storage of type '${type}' to ${value.toString()}. The minimum value is 0.`,
    );
  }

  const objective = getStorageScoreboardObjective(type);
  if (!objective) {
    raisePublic(
      PublicErrorType.NotRegistered,
      `Failed to set machine storage. Storage type '${type}' doesn't exist.`,
    );
  }

  return objective;
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

/**
 * @internal
 */
export function setScore(
  objective: ScoreboardObjective,
  participant: string,
  value: number,
): boolean {
  try {
    objective.setScore(participant, value);
    return true;
  } catch (e) {
    logWarn(
      `Failed to set objective '${objective.id}' score for '${participant}': ${String(e)}`,
    );
    return false;
  }
}
