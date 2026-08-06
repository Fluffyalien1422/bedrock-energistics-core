/**
 * A storage type texture description. This is the texture that will be used by default for storage bars of this type in machine UI.
 * @beta
 */
export interface StorageTypeTextureDescription {
  /**
   * Base ID for the bar's segment items.
   * @remarks
   * One slot of a storage bar is drawn with one item per fill level, from empty
   * to full, with the level appended to the base ID. A base ID of
   * 'example:example' at the default {@link
   * StorageTypeTextureDescription.segments} therefore needs 'example:example0'
   * through 'example:example16' - that is, `segments + 1` items, since empty is
   * a level too. All of them must have the
   * `fluffyalien_energisticscore:ui_item` tag.
   * @beta
   */
  baseId: string;
  /**
   * How many fill levels one slot of the bar has, not counting empty.
   * @remarks
   * Must be a positive integer. A bar `size` slots tall shows `size * segments`
   * levels across the whole bar, so a smaller number makes it coarser and needs
   * fewer items. The default matches the built-in textures, which are 16 pixels
   * tall and fill one pixel at a time.
   * @beta
   * @default 16
   */
  segments?: number;
  /**
   * Formatting code to prefix the label. ONLY include the formatting code, NOT the '§'. Multiple formatting codes can be used.
   * @remarks
   * To use multiple formatting codes, string them together with no separator. For example, "lc" will make the label bold (l) and red (c).
   * @beta
   */
  formattingCode?: string;
}

/**
 * A storage type texture preset. This is the texture that will be used by default for storage bars of this type in machine UI.
 * @beta
 */
export type StorageTypeTexturePreset =
  | "ammonia"
  | "black"
  | "blue"
  | "carbon"
  | "energy"
  | "green"
  | "hydrogen"
  | "lava"
  | "liquid_exp"
  | "nitrogen"
  | "oil"
  | "orange"
  | "oxygen"
  | "pink"
  | "purple"
  | "red"
  | "steam"
  | "water"
  | "white"
  | "yellow";

/**
 * @beta
 */
export interface StorageTypeDefinition {
  id: string;
  category: string;
  /**
   * The texture that will be used by default for storage bars of this type in machine UI. This can be a preset or a custom texture. Machines can override the texture for their own UI.
   * @beta
   */
  texture: StorageTypeTextureDescription | StorageTypeTexturePreset;
  name: string;
}
