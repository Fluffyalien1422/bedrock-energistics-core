---
title: Getting Started
---

# Getting Started

> [!warning]
> Bedrock Energistics Core is in beta. Minor updates may contain breaking changes. See [Versioning](versioning.md) for more information.

This guide assumes that you have a basic understanding of [JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript), [Node.js](https://nodejs.org/), [npm](https://www.npmjs.com/), and [Minecraft Bedrock add-on development](https://learn.microsoft.com/en-us/minecraft/creator/documents/gettingstarted).

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

The first thing you need to do to add a machine is create the block. All machines must have the `fluffyalien_energisticscore:machine` tag AND custom component.

To make a block that generates energy, it will need to have the `fluffyalien_energisticscore:io.type.energy` tag

To make a block that consumes energy, it will need to have both the `fluffyalien_energisticscore:io.type.energy` and `fluffyalien_energisticscore:consumer.type.energy` tags.

See [Machine I/O](machine-io.md) for more information.

In this guide, we will make a machine that simply generates a fixed amount of energy passively.

This is the full block JSON:

```json
{
  "format_version": "1.26.0",
  "minecraft:block": {
    "description": {
      "identifier": "example:passive_generator",
      "menu_category": {
        "category": "items"
      }
    },
    "components": {
      // Machines must have this custom component.
      "fluffyalien_energisticscore:machine": {},
      // This is our own custom component to add functionality.
      "example:passive_generator": {},

      // Machines must have this tag.
      "tag:fluffyalien_energisticscore:machine": {},
      // Tell Bedrock Energistics Core to connect our machines to energy networks.
      "tag:fluffyalien_energisticscore:io.type.energy": {},

      // All Bedrock Energistics Core machines and conduits must be immovable.
      "minecraft:movable": {
        "movement_type": "immovable"
      },

      // Our block needs to tick. The interval range can be any value you want.
      // Although, we recommend at least 5 ticks.
      "minecraft:tick": {
        "interval_range": [20, 20]
      },

      // Other components for our block.
      "minecraft:geometry": "minecraft:geometry.full_block",
      "minecraft:material_instances": {
        "*": {
          "texture": "cobblestone"
        }
      },
      "minecraft:destructible_by_mining": {
        "seconds_to_destroy": 1
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
  "format_version": "1.26.0",
  "minecraft:entity": {
    "description": {
      // By default, Bedrock Energistics Core will expect the machine entity to have the same
      // ID as the block. The entity ID can be specified as something else using the
      // `description.entityId` property when registering the machine.
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
      // An inventory is required to display the UI.
      "minecraft:inventory": {
        "container_type": "container",
        // Our machine UI is going to be just an energy bar, which takes up four
        // inventory slots by default.
        "inventory_size": 4
      },
      "minecraft:type_family": {
        // Machine entities must have this type family.
        "family": ["fluffyalien_energisticscore:machine_entity"]
      },

      // We want our entity to automatically despawn after some time.
      // This is not required, but recommended.
      "minecraft:timer": {
        "time": 60,
        "time_down_event": {
          "event": "example:despawn"
        }
      },
      "minecraft:despawn": {
        "despawn_from_distance": {
          "min_distance": 10,
          "max_distance": 20
        }
      },

      // 1x1 collision box so the UI can easily be opened.
      "minecraft:collision_box": {
        "width": 1,
        "height": 1
      },

      // Other components to make our entity invulnerable and immovable.
      "minecraft:breathable": {
        "breathes_water": true
      },
      "minecraft:physics": {
        "has_gravity": false,
        "has_collision": false
      },
      "minecraft:damage_sensor": {
        "triggers": {
          "deals_damage": "no"
        }
      },
      "minecraft:pushable": {
        "is_pushable": false,
        "is_pushable_by_piston": false
      },
      "minecraft:knockback_resistance": {
        "value": 1
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
            // The container title will be the block ID.
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
import { world, system } from "@minecraft/server";
import * as bec from "bedrock-energistics-core-api";

const ENERGY_GENERATION = 20;

world.afterEvents.worldLoad.subscribe(() => {
  // Initialize the Bedrock Energistics Core API.
  // Pass any unique ID to this function.
  // This should be the first thing that is called in `worldLoad`.
  bec.init("myExampleMachines");

  // We have to register every machine inside the `worldLoad` after event.
  // This snippet only shows the important machine definition options.
  // See full `MachineDefinition` interface: https://fluffyalien1422.github.io/bedrock-energistics-core/api/interfaces/API.MachineDefinition.html
  bec.registerMachine({
    description: {
      // The ID of the block.
      id: "example:passive_generator",
      // Optionally add `entityId` if your entity ID is not the same as the block.
      //entityId: "example:passive_generator_entity",
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
            defaults: {
              // Set the storage type of the bar.
              type: "energy",
            },
          },
        },
      },
    },
    handlers: {
      // Handlers are functions that respond to certain Bedrock Energistics Core events.
      // These functions return responses that tell Bedrock Energistics Core what to do.
      // For example, the `updateUi` handler is called during UI updates and can dynamically
      // modify the UI of the machine.
      // All handlers are optional.
      // See all handlers: https://fluffyalien1422.github.io/bedrock-energistics-core/api/interfaces/API.MachineDefinitionHandlers.html
    },
    events: {
      // Events are functions that are called after Bedrock Energistics Core
      // has done something.
      // Unlike handlers, these functions cannot modify what Bedrock Energistics Core does since
      // they are called after the event has been completed.
      // All events are optional.
      // See all events: https://fluffyalien1422.github.io/bedrock-energistics-core/api/interfaces/API.MachineDefinitionEvents.html
    },
  });
});

system.beforeEvents.startup.subscribe((e) => {
  // Register our custom component.
  e.blockComponentRegistry.registerCustomComponent(
    "example:passive_generator",
    {
      onTick(e) {
        // Generate energy every tick.
        bec.generate(e.block, "energy", ENERGY_GENERATION);
      },
    },
  );
});
```

Our machine is finished!
