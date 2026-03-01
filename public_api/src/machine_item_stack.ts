import { Enchantment, ItemStack } from "@minecraft/server";
import { logWarn } from "./log.js";

/**
 * Additional options for creating a new {@link MachineItemStack}.
 * @beta
 */
export interface NewMachineItemStackOptions {
  nameTag?: string;
  damage?: number;
  lore?: string[];
  enchantments?: Enchantment[];
}

/**
 * Represents an item stack that may be stored in a machine UI item slot.
 * @beta
 */
export class MachineItemStack {
  nameTag?: string;
  damage: number;
  lore: string[];
  enchantments: Enchantment[];

  constructor(
    public typeId: string,
    public amount = 1,
    options: NewMachineItemStackOptions = {},
  ) {
    this.nameTag = options.nameTag;
    this.damage = options.damage ?? 0;
    this.lore = options.lore ?? [];
    this.enchantments = options.enchantments ?? [];
  }

  /**
   * Converts a Minecraft `ItemStack` to a `MachineItemStack`.
   * @param itemStack The Minecraft `ItemStack` to convert.
   * @beta
   */
  static fromItemStack(itemStack: ItemStack): MachineItemStack {
    const id = itemStack.typeId;
    const amount = itemStack.amount;
    const nameTag = itemStack.nameTag;
    const damage = itemStack.getComponent("durability")?.damage ?? 0;
    const lore = itemStack.getLore();
    const enchantments =
      itemStack.getComponent("enchantable")?.getEnchantments() ?? [];

    return new MachineItemStack(id, amount, {
      nameTag,
      damage,
      lore,
      enchantments,
    });
  }

  /**
   * Converts this `MachineItemStack` to a Minecraft `ItemStack`.
   * @beta
   * @returns A Minecraft `ItemStack` with the same properties as this `MachineItemStack`.
   */
  toItemStack(): ItemStack {
    const result = new ItemStack(this.typeId, this.amount);

    result.nameTag = this.nameTag;

    {
      const durabilityComponent = result.getComponent("durability");
      if (durabilityComponent) {
        durabilityComponent.damage = this.damage;
      }
    }

    try {
      // lore may be invalid, this has caused issues before.

      result.setLore(this.lore);
    } catch (e) {
      logWarn(
        "A recoverable error occured while converting MachineItemStack to ItemStack: Failed to set lore: " +
          String(e),
      );
    }

    try {
      // just in case the enchantments are invalid

      result.getComponent("enchantable")?.addEnchantments(this.enchantments);
    } catch (e) {
      logWarn(
        "A recoverable error occured while converting MachineItemStack to ItemStack: Failed to add enchantment: " +
          String(e),
      );
    }

    return result;
  }

  /**
   * Tests if all properties of two `MachineItemStacks`, except `amount`, are the same.
   * @beta
   * @param other The other `MachineItemStack` to compare with.
   * @returns Whether the two `MachineItemStacks` are similar.
   */
  isSimilarTo(other: MachineItemStack): boolean {
    return (
      this.typeId === other.typeId &&
      this.damage === other.damage &&
      this.nameTag === other.nameTag &&
      // lore
      this.lore.length === other.lore.length &&
      this.lore.every((v, i) => other.lore[i] === v) &&
      // enchantments
      this.enchantments.length === other.enchantments.length &&
      this.enchantments.every((enchantment) =>
        other.enchantments.some(
          (otherEnchantment) =>
            enchantment.level === otherEnchantment.level &&
            enchantment.type.id === otherEnchantment.type.id,
        ),
      )
    );
  }

  /**
   * Clones this object.
   * @beta
   * @returns A new `MachineItemStack` with the same properties as this one.
   */
  clone(): MachineItemStack {
    return new MachineItemStack(this.typeId, this.amount, {
      nameTag: this.nameTag,
      damage: this.damage,
      lore: this.lore,
      enchantments: this.enchantments,
    });
  }

  /**
   * Clones this object and sets the amount to the given value.
   * @beta
   * @param amount The new amount.
   * @returns A new `MachineItemStack` with the same properties as this one, but with the given amount.
   */
  withAmount(amount: number): MachineItemStack {
    return new MachineItemStack(this.typeId, amount, {
      nameTag: this.nameTag,
      damage: this.damage,
      lore: this.lore,
      enchantments: this.enchantments,
    });
  }
}
