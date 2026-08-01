/*

serialization format info:

type_id(amount "name tag" damage "lore line 1","lore line 2" enchant@level,enchant2@level)

- damage refers to ItemDurabilityComponent#damage
  (https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/itemdurabilitycomponent?view=minecraft-bedrock-experimental#damage)

- space is the separator

- enchantments, lore, and name tag are optional, others are expected
  to have a value even if they're is not used (for example,
  damage is still required for items that have no durability)

- name tag is a string, only double quotes are allowed,
  double quotes inside must be escaped with backslashes \"

- \" and \n are the only valid escape codes in strings

examples:
minecraft:dirt(1 "my dirt" 0  )
minecraft:dirt(1  0  )
minecraft:wooden_sword(1  0  sharpness@1,unbreaking@2)
*/

import { Enchantment, EnchantmentType } from "@minecraft/server";
import { MachineItemStack } from "./machine_item_stack.js";
import { raise } from "./log.js";

/**
 * @internal
 */
export function deserializeMachineItemStack(data: string): MachineItemStack {
  const parser = new DeserializeParser(data);
  return parser.parse();
}

function serializeString(str: string): string {
  return (
    '"' +
    str
      // Escape backslashes first, otherwise the escape sequences introduced by
      // the replacements below would be escaped again on the next pass.
      .replaceAll("\\", "\\\\")
      .replaceAll('"', '\\"')
      .replaceAll("\n", "\\n") +
    '"'
  );
}

/**
 * @internal
 */
export function serializeMachineItemStack(itemStack: MachineItemStack): string {
  const id = itemStack.typeId;
  const amount = itemStack.amount;
  const nameTag = itemStack.nameTag;
  const damage = itemStack.damage;
  const lore = itemStack.lore;
  const enchantments = itemStack.enchantments;

  return `${id}(${amount.toString()} ${
    nameTag ? serializeString(nameTag) : ""
  } ${damage.toString()} ${
    lore.length ? lore.map((s) => serializeString(s)).join(",") : ""
  } ${enchantments
    .map(
      (enchantment) => `${enchantment.type.id}@${enchantment.level.toString()}`,
    )
    .join(",")})`;
}

class DeserializeParser {
  private index = 0;
  constructor(private readonly data: string) {}

  /**
   * @returns `true` if the current character is the last character, otherwise `false`
   */
  private isEoi(): boolean {
    return this.index + 1 >= this.data.length;
  }

  private next(): void {
    if (this.isEoi()) {
      raise("Failed to deserialize data: Reached EOI before completing parse.");
    }

    this.index++;
  }

  private getCurrentChar(): string {
    return this.data[this.index];
  }

  private read(endChars: string[]): string {
    let s = "";
    while (!endChars.includes(this.getCurrentChar())) {
      s += this.getCurrentChar();
      this.next();
    }
    return s;
  }

  private readString(): string {
    let s = "";
    this.next();

    while (this.getCurrentChar() !== '"') {
      const char = this.getCurrentChar();

      if (char === "\\") {
        this.next();

        const char = this.getCurrentChar();
        if (char === '"') {
          s += '"';
        } else if (char === "n") {
          s += "\n";
        } else if (char === "\\") {
          s += "\\";
        } else {
          raise(
            `Failed to deserialize data: Could not read string: Illegal escape code: '\\${char}'.`,
          );
        }

        this.next();
        continue;
      }

      s += char;
      this.next();
    }

    this.next();
    return s;
  }

  private readEnchantments(enchantments: Enchantment[] = []): Enchantment[] {
    const id = this.read(["@"]);
    this.next();

    const level = Number(this.read([",", ")"]));
    if (isNaN(level)) {
      raise(
        "Failed to deserialize data: Could not read enchantments: Enchantment level is not a number.",
      );
    }

    enchantments.push({ type: new EnchantmentType(id), level });

    const char = this.getCurrentChar();

    if (char === ",") {
      this.next();
      this.readEnchantments(enchantments);
    } else if (char !== ")") {
      raise(
        `Failed to deserialize data: Could not read enchantments: Reached illegal character: '${char}'.`,
      );
    }

    return enchantments;
  }

  private readLore(lore: string[] = []): string[] {
    const str = this.readString();

    lore.push(str);

    const char = this.getCurrentChar();

    if (char === ",") {
      this.next();
      this.readLore(lore);
    } else if (char !== " ") {
      raise(
        `Failed to deserialize data: Could not read lore: Reached illegal character: '${char}'.`,
      );
    }

    return lore;
  }

  parse(): MachineItemStack {
    // parse

    const id = this.read(["("]);
    this.next();

    const amount = Number(this.read([" "]));
    // Checked here as well as by the MachineItemStack constructor, so that data
    // we serialized ourselves failing to parse is reported as our fault rather
    // than as a bad argument from whoever asked to read it.
    if (!Number.isInteger(amount) || amount <= 0) {
      raise(
        `Failed to deserialize data: Item stack amount is not a positive integer: ${amount.toString()}.`,
      );
    }
    this.next();

    const nameTag =
      this.getCurrentChar() === '"' ? this.readString() : undefined;
    this.next();

    const damage = Number(this.read([" "]));
    if (isNaN(damage)) {
      raise("Failed to deserialize data: Item stack damage is not a number.");
    }
    this.next();

    const lore = this.getCurrentChar() === '"' ? this.readLore() : [];
    this.next();

    const enchantments =
      this.getCurrentChar() === ")" ? [] : this.readEnchantments();

    // make result

    return new MachineItemStack(id, amount, {
      nameTag,
      damage,
      lore,
      enchantments,
    });
  }
}
