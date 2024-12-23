import { Block } from "@minecraft/server";

const IO_TYPE_TAG_PREFIX = "fluffyalien_energisticscore:io.type.";
const IO_CATEGORY_TAG_PREFIX = "fluffyalien_energisticscore:io.category.";

export interface MachineIo {
  types: string[];
  categories: string[];
}

export function getMachineIo(machine: Block): MachineIo | "any" {
  const tags = machine.getTags();

  if (tags.includes("fluffyalien_energisticscore:io.any")) return "any";

  const types = tags.filter((tag) => tag.startsWith(IO_TYPE_TAG_PREFIX));
  const categories = tags.filter((tag) =>
    tag.startsWith(IO_CATEGORY_TAG_PREFIX),
  );

  return {
    types: types.map((tag) => tag.slice(IO_TYPE_TAG_PREFIX.length)),
    categories: categories.map((tag) =>
      tag.slice(IO_CATEGORY_TAG_PREFIX.length),
    ),
  };
}
