---
title: Getting Started
---

# Getting Started

This guide assumes that you have a basic understanding of [JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript), [Node.js](https://nodejs.org/), [npm](https://www.npmjs.com/), and an advanced understanding of [Minecraft Bedrock add-on development](https://learn.microsoft.com/en-us/minecraft/creator/documents/gettingstarted).

Before getting started, ensure that you're using a Minecraft version that Bedrock Energistics Core supports. Each release will note which Minecraft versions it supports. Bedrock Energistics Core's latest release usually supports the latest Minecraft stable release. See [releases](https://github.com/Fluffyalien1422/bedrock-energistics-core/releases).

## Including Bedrock Energistics Core API

In order for your add-on to interact with Bedrock Energistics Core. You need to include Bedrock Energistics Core API in your project.

Bedrock Energistics Core API can be installed and updated with the following command:

```sh
npm i bedrock-energistics-core-api@latest
```

Bedrock Energistics Core API needs to be bundled with the rest of your scripts in order to be used in Minecraft. This can be done with a bundler such as [esbuild](https://esbuild.github.io/) or [rollup.js](https://rollupjs.org/).

We recommend minifying your bundle in production builds to reduce the size. This can be done with a minifier such as [terser](https://terser.org/).

We recommend using [Regolith](https://bedrock-oss.github.io/regolith/) to automatically run your bundler and your minifier if you choose to minify your bundle.

Ensure that your add-on is using a version of `@minecraft/server` that Bedrock Energistics Core API supports. Each release will note which `@minecraft/server` versions it supports. See [releases](https://github.com/Fluffyalien1422/bedrock-energistics-core/releases).

## Creating a Machine

### Creating the Block

The first thing you need to do to add a machine is create the block.

To make a block that generates energy, it will need to have the `fluffyalien_energisticscore:io.energy` tag

To make a block that consumes energy, it will need to have both the `fluffyalien_energisticscore:io.energy` and `fluffyalien_energisticscore:consumer.energy` tags.

See [Machine Block Tags](machine-block-tags.md) for more information on tags.

In this guide, we will make a machine that simply generates a fixed amount of energy passively.

This is the full block JSON:

```json
{
  "format_version": "1.21.0",
  "minecraft:block": {
    "description": {
      "identifier": "example:passive_generator",
      "menu_category": {
        "category": "items"
      }
    },
    "components": {
      "minecraft:custom_components": [
        // Machines must have this custom component.
        "fluffyalien_energisticscore:machine",
        // This is our own custom component to add functionality.
        "example:passive_generator"
      ],
      // Machines must have this tag.
      "tag:fluffyalien_energisticscore:machine": {},
      "tag:fluffyalien_energisticscore:io.energy": {},

      "minecraft:geometry": "minecraft:geometry.full_block",
      "minecraft:material_instances": {
        "*": {
          "texture": "cobblestone"
        }
      },
      // We don't want our block to be destructible by explosions as that can cause some internal issues.
      "minecraft:destructible_by_explosion": false,
      "minecraft:destructible_by_mining": {
        "seconds_to_destroy": 1
      },
      // Our block needs to tick. The interval range can be any value you want.
      // Although, we recommend at least 5 ticks.
      "minecraft:tick": {
        "interval_range": [20, 20]
      }
    }
  }
}
```

### Creating the Entity

We need to create an entity for our machine UI. This entity will not be persistent, it will only be spawned on interact and will despawn soon after. Although, it is possible to create [persistent machine entities](persistent-entities.md).

This is the full entity JSON:

```json
{
  "format_version": "1.21.0",
  "minecraft:entity": {
    "description": {
      // Machine entities must have the same ID as their block.
      "identifier": "example:passive_generator",
      // Machine entities must be summonable.
      "is_summonable": true,
      "is_spawnable": false
    },
    "component_groups": {
      "example:despawn": {
        "minecraft:instant_despawn": {}
      }
    },
    "components": {
      "minecraft:despawn": {
        "despawn_from_distance": {
          "min_distance": 10,
          "max_distance": 20
        }
      },
      // We want our entity to automatically despawn after some time.
      // This is not required, but recommended.
      "minecraft:timer": {
        "time": 60,
        "time_down_event": {
          "event": "example:despawn"
        }
      },
      "minecraft:breathable": {
        "breathes_water": true
      },
      "minecraft:physics": {
        "has_gravity": false,
        "has_collision": false
      },
      "minecraft:damage_sensor": {
        "triggers": {
          "deals_damage": false
        }
      },
      "minecraft:pushable": {
        "is_pushable": false,
        "is_pushable_by_piston": false
      },
      "minecraft:knockback_resistance": {
        "value": 1
      },
      "minecraft:collision_box": {
        "width": 1,
        "height": 1
      },
      "minecraft:inventory": {
        "container_type": "container",
        // Our machine UI is going to be just an energy bar, which takes up four inventory slots.
        "inventory_size": 4
      },
      "minecraft:type_family": {
        // Machine entities must have this type family.
        "family": ["fluffyalien_energisticscore:machine_entity"]
      }
    },
    "events": {
      "example:despawn": {
        "add": {
          "component_groups": ["example:despawn"]
        }
      }
    }
  }
}
```

### Creating the UI

The UI backend is handled by Bedrock Energistics Core, but you will need to use JSON UI to design your machine's frontend UI. JSON UI is complicated, so we will not go over it in this guide. You can learn more about JSON UI [here](https://wiki.bedrock.dev/json-ui/json-ui-intro.html).

Bedrock Energistics Core also provides some commonly used UI controls, which we will be using to make our UI. See [Machine UI](machine-ui.md) for more information on these.

Copy this into `RP/ui/example/passive_generator.json`:

```json
{
  "namespace": "example:passive_generator",
  "root": {
    "type": "panel",
    "controls": [
      {
        "container_gamepad_helpers@common.container_gamepad_helpers": {}
      },
      {
        "flying_item_renderer@common.flying_item_renderer": {
          "layer": 14
        }
      },
      {
        "selected_item_details_factory@common.selected_item_details_factory": {}
      },
      {
        "item_lock_notification_factory@common.item_lock_notification_factory": {}
      },
      {
        "root_panel@common.root_panel": {
          "layer": 1,
          "size": [180, 180],
          "controls": [
            {
              "common_panel@common.common_panel": {}
            },
            {
              "chest_panel": {
                "type": "panel",
                "layer": 5,
                "offset": [0, -0.5],
                "controls": [
                  {
                    "small_chest_panel_top_half@example:passive_generator.top_half": {}
                  },
                  {
                    "inventory_panel_bottom_half_with_label@common.inventory_panel_bottom_half_with_label": {}
                  },
                  {
                    "hotbar_grid@common.hotbar_grid_template": {}
                  },
                  {
                    "inventory_take_progress_icon_button@common.inventory_take_progress_icon_button": {}
                  }
                ]
              }
            },
            {
              "inventory_selected_icon_button@common.inventory_selected_icon_button": {}
            },
            {
              "gamepad_cursor@common.gamepad_cursor_button": {}
            }
          ]
        }
      }
    ]
  },
  "top_half": {
    "type": "panel",
    "size": ["100%", "50% - 12px"],
    "offset": [0, 7],
    "anchor_to": "top_left",
    "anchor_from": "top_left",
    "controls": [
      {
        "title@fluffyalien_energisticscore:common.container_title": {
          "text": "Passive Generator"
        }
      },
      {
        "energy_bar@fluffyalien_energisticscore:common.machine_storage_bar": {
          "offset": [9, 12]
        }
      }
    ]
  }
}
```

Copy this into `RP/ui/chest_screen.json`:

```json
{
  "small_chest_screen": {
    "$new_container_title|default": "$container_title",
    "modifications": [
      {
        "array_name": "variables",
        "operation": "insert_back",
        "value": [
          {
            "requires": "($new_container_title = 'example:passive_generator')",
            "$screen_content": "example:passive_generator.root",
            "$screen_bg_content": "common.screen_background"
          }
        ]
      }
    ]
  }
}
```

Copy this into `RP/ui/_ui_defs.json`:

```json
{
  "ui_defs": ["ui/example/passive_generator.json"]
}
```

### Scripting the Machine

Now for the fun part, scripting!

Copy the following script into your entry point file:

```js
import { world } from "@minecraft/server";
import * as beCore from "bedrock-energistics-core-api";

// Initialize the Bedrock Energistics Core API.
// Pass the namespace of your add-on to this function.
beCore.init("example");

const ENERGY_GENERATION = 20;

// Divide by 20 because our block has a 20 tick interval.
const ENERGY_GENERATION_PER_TICK = ENERGY_GENERATION / 20;

world.afterEvents.worldInitialize.subscribe(() => {
  // We have to register every machine inside the `worldInitialize` after event.
  beCore.registerMachine({
    description: {
      id: "example:passive_generator",
      ui: {
        elements: {
          // Elements can be named whatever you want.
          energyBar: {
            type: "storageBar",
            // This is the starting index in the inventory for this storage bar.
            // It should match the `$start_index` variable used in the JSON UI
            // (assuming the control extends `fluffyalien_energisticscore:common.machine_storage_bar`)
            // If `$start_index` wasn't defined, then this should be 0.
            startIndex: 0,
          },
        },
      },
    },
    handlers: {
      // This handler is called whenever the UI needs to be updated.
      // It can take an argument for the `DimensionLocation` of the machine.
      // But, we don't need it for this machine.
      updateUi() {
        return {
          storageBars: {
            // Referencing the element we defined in `description.ui.elements`
            energyBar: {
              // Setting it's storage type to `energy`.
              type: "energy",
              // This is how much it is changing per tick, this value can be negative or zero.
              change: ENERGY_GENERATION_PER_TICK,
            },
          },
        };
      },
    },
  });
});

world.beforeEvents.worldInitialize.subscribe((e) => {
  // Create our custom component.
  e.blockComponentRegistry.registerCustomComponent(
    "example:passive_generator",
    {
      onTick(e) {
        // Generate energy.
        beCore.generate(e.block, "energy", ENERGY_GENERATION);
      },
    },
  );
});
```

Our machine is finished!
