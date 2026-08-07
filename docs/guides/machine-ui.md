---
title: Machine UI
---

# Machine UI

A machine UI has two halves:

- The **frontend** is JSON UI: a screen that lays out the title, the slots, and any decoration.
- The **backend** is Bedrock Energistics Core: it fills those slots from the elements you declare in `description.ui.elements` in your machine definition.

Under the hood, a machine UI is the container of the machine's entity, so every element occupies one or more inventory slots and the JSON UI decides where each of those slots is drawn.

## Slots

A storage bar takes up four slots by default. Every other element takes up one. Two rules follow from that:

- The machine entity's `minecraft:inventory` must be large enough for every element.
- The indices in your machine definition must match the indices in your JSON UI. A `storageBar` with `startIndex: 4` needs a JSON UI storage bar with `"$start_index": 4`.

## JSON UI

Bedrock Energistics Core ships the JSON UI elements needed to build a machine screen in the `fluffyalien_energisticscore:common_v2` namespace. They are available to any add-on that depends on Bedrock Energistics Core, so you do not need to copy them into your own pack. The [JSON UI Reference](../json-ui-ref.md) documents each of them and their props.

> [!warning]
> The old `fluffyalien_energisticscore:common` namespace is deprecated and will be removed in a future update. Use `common_v2` for new UIs.

This guide won't go over JSON UI itself, you can learn about that [here](https://wiki.bedrock.dev/json-ui/json-ui-intro.html).

A screen extends `screen_template` and points it at a panel holding the machine's own content, which is usually an extension of `content_template`. Inside that panel go the title and one control per slot, each placed with an `offset`. Here is an example screen for a machine with an energy bar, an input slot, and a progress arrow:

```json
{
  // This is an untested example screen. Elements may not actually be positioned well.

  "namespace": "example:pulverizer",

  "screen@fluffyalien_energisticscore:common_v2.screen_template": {
    "$content_ref": "example:pulverizer.content"
  },

  "content@fluffyalien_energisticscore:common_v2.content_template": {
    "controls": [
      {
        "title@fluffyalien_energisticscore:common_v2.container_title": {
          "text": "tile.example:pulverizer.name"
        }
      },
      {
        // Slots 0-3.
        "energy_bar@fluffyalien_energisticscore:common_v2.machine_storage_bar": {
          "offset": [8, 12]
        }
      },
      {
        // Slot 4. The player can take from and place into this one.
        "input_slot@fluffyalien_energisticscore:common_v2.container_slot_item": {
          "offset": [44, 24],
          "$index": 4
        }
      },
      {
        // Slot 5. Display only, so the 'noclick' variant.
        "progress_arrow@fluffyalien_energisticscore:common_v2.container_slot_nobg_noclick": {
          "offset": [70, 24],
          "$index": 5
        }
      }
    ]
  }
}
```

Machine screens are hooked up through vanilla's `small_chest_screen`. See [Getting Started](getting-started.md) for that part.

## Declaring Elements

The elements above are declared like this in the machine definition:

```js
bec.registerMachine({
  description: {
    id: "example:pulverizer",
    ui: {
      elements: {
        // Element IDs can be anything. They are how `updateUi` and machine
        // slot item functions refer to an element.
        energyBar: {
          type: "storageBar",
          startIndex: 0,
          defaults: {
            type: "energy",
          },
        },
        inputSlot: {
          type: "itemSlot",
          index: 4,
          allowedItems: ["minecraft:cobblestone"],
        },
        progress: {
          type: "progressIndicator",
          indicator: "arrow",
          index: 5,
        },
      },
    },
  },
});
```

See {@link UiElementDefinition} for every element type and the options each one takes. Leave `description.ui` undefined and Bedrock Energistics Core skips UI handling for the machine entirely.

## Updating Elements

While a player has a machine's UI open, its elements are redrawn every few ticks. To make an element reflect the machine's state, give your machine definition an `updateUi` handler. It is called on each redraw and returns the state of the machine's storage bars, progress indicators, and buttons, keyed by element ID.

```js
handlers: {
  // May be async.
  updateUi() {
    return {
      storageBars: {
        energyBar: { type: "energy" },
      },
      progressIndicators: {
        progress: 8,
      },
    };
  },
},
```

Anything the handler leaves `undefined` falls back to the element's `defaults`. An element with neither is drawn in its inactive form: a storage bar shows as "Disabled" and a progress indicator shows its first frame. See {@link MachineUpdateUiHandlerRes} for what may be returned.

Item slots are not part of this. They hold whatever was last stored in them and are updated with the machine slot item functions, such as {@link setMachineSlotItem}, whether or not a UI is open.

## Storage Bars

A storage bar shows how much of one storage type the machine holds, and its hover text reads `<amount>/<max> <storage type name>` unless a `label` overrides it. Which type it shows, what counts as full, and the texture it uses can all be set per redraw, or defaulted in the element definition. See {@link UiStorageBarElementUpdateOptions}, and [Storage Types](storage-types.md) for what a bar texture is made of.

A bar's `size` is how many slots it occupies, defaulting to 4. `machine_storage_bar` draws exactly four slots, so a bar of another size needs its segments laid out with `container_slot_nobg_noclick`.

## Progress Indicators

A progress indicator is one slot showing a frame of an animation, either one of the presets (the arrow and flame from the Minecraft furnace) or your own frames.

The value returned from `updateUi` is a frame number, not a percentage. It must be an integer from 0 to the indicator's maximum, inclusive. Anything else logs a warning and draws the error item.

Maximum values:

- Arrow: 16
- Flame: 13
- Custom: one less than the number of frames

## Item Slots

Item slots let a machine store items without a persistent entity.

A slot's contents are saved as a {@link MachineItemStack}, which keeps an item's type, amount, name tag, damage, lore, and enchantments, and nothing else. An item carrying more than that does not survive being stored: a shulker box with items in it comes back out as an empty shulker box.

Because of this, setting `allowedItems` to the items your machine actually needs is highly recommended. As well as keeping out items the machine has no use for, it stops a player from placing one that cannot be stored intact.

If a slot has to accept any item at all, use a persistent entity and access its container directly rather than using an item slot element. See the [Persistent Entities](persistent-entities.md) guide.

## Buttons

A button is one slot holding an item the player can "press". A container has no click event, so a press is inferred from the player picking the item up: the item is put straight back, and the machine's `onButtonPressed` event is called with the element ID and the ID of the player who pressed it.

```js
events: {
  onButtonPressed(e) {
    if (e.elementId === "myButton") {
      // ...
    }
  },
},
```

Since a button has to be picked up to be pressed, draw it with a slot the player can interact with, such as `container_slot_nobg`, not a `noclick` variant.
