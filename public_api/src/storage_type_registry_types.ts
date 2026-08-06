/**
 * A storage type texture description. This is the texture that will be used by default for storage bars of this type in machine UI.
 * @beta
 */
export interface StorageTypeTextureDescription {
  /**
   * Base ID for all 16 UI items.
   * @remarks
   * The index will be appended to the end of the base ID. For example, if the base ID is 'example:example' then 'example:example0' to 'example:example15' will be used. All items must have the `fluffyalien_energisticscore:ui_item` tag.
   * @beta
   */
  baseId: string;
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
