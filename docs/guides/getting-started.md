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
  "format_version": "1.26.40",
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

      "minecraft:tags": [
        // Machines must have this tag.
        "fluffyalien_energisticscore:machine",
        // Tell Bedrock Energistics Core to connect our machines to energy networks.
        "fluffyalien_energisticscore:io.type.energy"
      ],

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
  "format_version": "1.26.40",
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

Bedrock Energistics Core provides the JSON UI elements needed to build a machine screen in the `fluffyalien_energisticscore:common_v2` namespace, which is what we will use here. See [Machine UI](machine-ui.md) for how machine UIs work and the [JSON UI Reference](../json-ui-ref.md) for every element these packs provide.

> [!note]
> The older `fluffyalien_energisticscore:common` namespace is deprecated and will be removed in a future update. Use `common_v2` for new UIs.

Copy this into `RP/ui/example/passive_generator.json`:

```json
{
  "namespace": "example:passive_generator",

  // 'screen_template' lays out the player inventory and hotbar in the bottom
  // half of the screen and our machine's content in the top half.
  "screen@fluffyalien_energisticscore:common_v2.screen_template": {
    "$content_ref": "example:passive_generator.content"
  },

  // 'content_template' is a panel already sized and positioned to fill the
  // content area in the top half. We add our machine's controls to it.
  "content@fluffyalien_energisticscore:common_v2.content_template": {
    "controls": [
      {
        "title@fluffyalien_energisticscore:common_v2.container_title": {
          // A translation key or a plain string.
          "text": "tile.example:passive_generator.name"
        }
      },
      {
        // A standard storage bar: four slots stacked vertically. Its first slot
        // index is set with '$start_index', which defaults to 0, so this bar
        // uses slots 0-3.
        "energy_bar@fluffyalien_energisticscore:common_v2.machine_storage_bar": {
          "offset": [8, 12]
        }
      }
    ]
  }
}
```

Machine screens are hooked up through vanilla's `small_chest_screen`. Copy this into `RP/ui/chest_screen.json`:

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
            "$screen_content": "example:passive_generator.screen",
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

Our title is a translation key, so add this to `RP/texts/en_US.lang`:

```
tile.example:passive_generator.name=Passive Generator
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
            // It must match the `$start_index` variable used in the JSON UI
            // (assuming the control extends
            // `fluffyalien_energisticscore:common_v2.machine_storage_bar`).
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
        // Send our energy to the network. Call this on every block tick, even
        // when generating `0`, since it also sends the machine's reserve
        // storage (whatever the network could not take last time).
        bec.generate(e.block, "energy", ENERGY_GENERATION);
      },
    },
  );
});
```

Our machine is finished!
