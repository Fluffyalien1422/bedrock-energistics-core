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
   * Formatting code to prefix the label. ONLY include the formatting code, not the '§'. To use multiple formatting codes, separate with spaces.
   * @beta
   */
  formattingCode?: string;
}

/**
 * A storage type texture preset. This is the texture that will be used by default for storage bars of this type in machine UI.
 * @beta
 */
export type StorageTypeTexturePreset =
  | "black"
  | "orange"
  | "pink"
  | "purple"
  | "red"
  | "yellow"
  | "blue"
  | "white"
  | "green";

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
