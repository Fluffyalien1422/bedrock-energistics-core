/**
 * The longest name tag an item accepts. `ItemStack.nameTag` and
 * `ContainerSlot.nameTag` throw if set to anything longer.
 * @internal
 */
export const MAX_ITEM_NAME_TAG_LENGTH = 255;

/**
 * Cuts a name tag down to {@link MAX_ITEM_NAME_TAG_LENGTH} characters, with a
 * warning, so that setting it on an item can't throw. Name tags set on items
 * often come from add-ons (UI labels, button names, storage type names,
 * machine item stacks).
 * @internal
 * @param nameTag The name tag to set.
 * @param context What the name tag is for, for the warning, e.g. "the
 * 'progress' element of 'example:pulverizer'".
 * @param warn The calling pack's warning logger.
 */
export function fitItemNameTag(
  nameTag: string,
  context: string,
  warn: (message: string) => void,
): string {
  if (nameTag.length <= MAX_ITEM_NAME_TAG_LENGTH) return nameTag;

  warn(
    `The name tag for ${context} is longer than ${MAX_ITEM_NAME_TAG_LENGTH.toString()} characters and was truncated: '${nameTag}'.`,
  );
  return nameTag.slice(0, MAX_ITEM_NAME_TAG_LENGTH);
}
