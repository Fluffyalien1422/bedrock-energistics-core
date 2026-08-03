import { Enchantment, ItemStack } from "@minecraft/server";
import { PublicErrorType } from "./error.js";
import { logWarn, raisePublic } from "./log.js";

// Only the lower bound is enforced. Checking the amount against the item's
// maximum stack size would mean constructing an ItemStack to read `maxAmount`
// from, on every construction - which includes every read of stored slot data,
// every `withAmount` and every `clone` - and would make a slot holding an item
// that no longer exists throw on read instead of being recoverable. Machine
// item slots check it when a stack is stored in one.
/**
 * @throws Throws if `amount` is not a positive integer.
 */
function validateAmount(amount: number): void {
  if (amount <= 0 || !Number.isInteger(amount)) {
    raisePublic(
      PublicErrorType.InvalidArgument,
      `Invalid MachineItemStack amount. Expected a positive integer but got ${amount.toString()}.`,
    );
  }
}

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
 * @remarks
 * Carries an item's type, amount, name tag, damage, lore and enchantments, and
 * nothing else. An item holding more than that does not survive a round trip
 * through one: a shulker box with items in it becomes an empty shulker box.
 *
 * Machine item slots store their contents this way, so restrict them with
 * {@link UiItemSlotElementDefinition.allowedItems}, or use a persistent entity's
 * container instead if a slot has to accept any item.
 */
export class MachineItemStack {
  nameTag?: string;
  damage: number;
  lore: string[];
  enchantments: Enchantment[];

  private internalAmount: number;

  /**
   * Creates a new `MachineItemStack`.
   * @beta
   * @param typeId The ID of the item type this stack holds.
   * @param amount The number of items in the stack. See {@link MachineItemStack.amount}.
   * @param options Additional item properties. See {@link NewMachineItemStackOptions}.
   * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidArgument} if `amount` is not a positive integer.
   */
  constructor(
    public typeId: string,
    amount = 1,
    options: NewMachineItemStackOptions = {},
  ) {
    validateAmount(amount);
    this.internalAmount = amount;

    this.nameTag = options.nameTag;
    this.damage = options.damage ?? 0;
    // Copy the collections rather than storing the caller's. Without this, two
    // stacks built from the same options - notably the copy that `clone` and
    // `withAmount` produce - would share this state, so mutating one would
    // silently change the other. `Enchantment` is itself mutable (its `level`
    // is writable), so the entries are copied too; the `type` is just an ID
    // wrapper and is safe to share.
    this.lore = options.lore ? [...options.lore] : [];
    this.enchantments =
      options.enchantments?.map((enchantment) => ({ ...enchantment })) ?? [];
  }

  /**
   * The number of items in this stack.
   * @beta
   * @remarks
   * Always a positive integer, as it is for Minecraft's `ItemStack.amount`. An
   * empty machine item slot is represented by having no `MachineItemStack` at
   * all, not by one with an amount of zero.
   *
   * This is not checked against the item's maximum stack size, so a stack you
   * are holding may exceed it. Storing one that does in a machine item slot
   * throws, since a slot can only show a single stack.
   * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidArgument} if set to anything other than a positive integer.
   */
  get amount(): number {
    return this.internalAmount;
  }

  set amount(value: number) {
    validateAmount(value);
    this.internalAmount = value;
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
   * @remarks
   * An `ItemStack` cannot hold more than one stack of an item, so an
   * {@link MachineItemStack.amount} above the item's maximum stack size is
   * reduced to fit and a warning is logged.
   * @returns A Minecraft `ItemStack` with the same properties as this `MachineItemStack`.
   * @throws Throws if the item type does not exist.
   */
  toItemStack(): ItemStack {
    // Clamped rather than thrown on because this runs while rendering a
    // machine's UI and while dropping its contents as it breaks, both far too
    // big to fail over one slot. Storing an oversized amount in a slot is
    // rejected up front, so this shouldn't be reachable anyway. The lower bound
    // needs no clamp: `amount` can't go below 1.
    const result = new ItemStack(this.typeId);

    const amount = Math.min(this.amount, result.maxAmount);
    if (amount !== this.amount) {
      logWarn(
        `Clamped the amount of the item '${this.typeId}' from ${this.amount.toString()} to ${amount.toString()} while converting a MachineItemStack to an ItemStack. A machine item slot cannot hold more than one stack.`,
      );
    }
    result.amount = amount;

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
   * @param amount The new amount. See {@link MachineItemStack.amount}.
   * @returns A new `MachineItemStack` with the same properties as this one, but with the given amount.
   * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidArgument} if `amount` is not a positive integer. To empty a machine item slot, store no item in it rather than a stack of zero.
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
