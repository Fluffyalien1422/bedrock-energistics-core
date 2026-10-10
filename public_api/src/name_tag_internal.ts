/**
 * The longest name tag an item accepts. `ItemStack.nameTag` and
 * `ContainerSlot.nameTag` throw if set to anything longer.
 * @internal
 */
export const MAX_ITEM_NAME_TAG_LENGTH = 255;

/** Contexts already warned about, so a redrawn UI doesn't repeat the warning. */
const warnedContexts = new Set<string>();

/**
 * Cuts a name tag down to {@link MAX_ITEM_NAME_TAG_LENGTH} characters, so that
 * setting it on an item can't throw.
 * @internal
 * @remarks
 * Name tags set on items often come from add-ons (UI labels, button names,
 * storage type names, machine item stacks), so an over-long one is truncated
 * with a warning rather than failing whatever was setting it.
 * @param nameTag The name tag to set.
 * @param context What the name tag is for, e.g. "the 'progress' element of
 * 'example:pulverizer'". The warning is logged once per context, since UI
 * elements are redrawn every few ticks.
 * @param warn The calling pack's warning logger.
 * @returns `nameTag`, truncated if it was too long.
 */
export function fitItemNameTag(
  nameTag: string,
  context: string,
  warn: (message: string) => void,
): string {
  if (nameTag.length <= MAX_ITEM_NAME_TAG_LENGTH) return nameTag;

  if (!warnedContexts.has(context)) {
    warnedContexts.add(context);
    warn(
      `The name tag for ${context} is longer than ${MAX_ITEM_NAME_TAG_LENGTH.toString()} characters and was truncated: '${nameTag}'.`,
    );
  }

  // don't leave half a formatting code at the end
  return nameTag.slice(0, MAX_ITEM_NAME_TAG_LENGTH).replace(/§$/, "");
}
