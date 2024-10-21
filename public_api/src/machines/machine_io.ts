import { Direction } from "@minecraft/server";

/**
 * Checks each side of a block to see if it allows IO connections of a specific category
 */
export function getAllMachineIO(
  blockTags: string[],
  category: string,
): Record<Direction, boolean> {
  // filter for the tags specific to this block
  const directives = blockTags
    .filter((t) => t.startsWith(`fluffyalien_energisticscore:io.${category}`))
    .map((t) => t.replace(`fluffyalien_energisticscore:io.${category}`, ""));

  // check for the ._any tag which allows for all categories
  directives.push(
    ...blockTags
      .filter((t) => t.startsWith(`fluffyalien_energisticscore:io._any`))
      .map((t) => t.replace(`fluffyalien_energisticscore:io._any`, "")),
  );

  const all = directives.includes("");

  return {
    [Direction.Down]: all || directives.includes(".down"),
    [Direction.East]: all || directives.includes(".east"),
    [Direction.North]: all || directives.includes(".north"),
    [Direction.South]: all || directives.includes(".south"),
    [Direction.Up]: all || directives.includes(".up"),
    [Direction.West]: all || directives.includes(".west"),
  };
}

export function blockHasIoOnSide(blockTags: string[], category: string, direction: Direction): boolean {
    // filter for the tags specific to this block
    const directives = blockTags
    .filter((t) => t.startsWith(`fluffyalien_energisticscore:io.${category}`))
    .map((t) => t.replace(`fluffyalien_energisticscore:io.${category}`, ""));

  // check for the ._any tag which allows for all categories
  directives.push(
    ...blockTags
      .filter((t) => t.startsWith(`fluffyalien_energisticscore:io._any`))
      .map((t) => t.replace(`fluffyalien_energisticscore:io._any`, "")),
  );

  return directives.includes("") || direction.includes(direction.toLowerCase()); 
}