---
title: Machine UI
---

# Machine UI

Machine UIs should be created using JSON UI and elements should be defined in the machine definition so Bedrock Energistics Core can handle the UI backend. This guide will not go over JSON UI, you can learn more about that [here](https://wiki.bedrock.dev/json-ui/json-ui-intro.html).

Machine UIs are actually just entity inventories. Each element takes up a certain amount of slots. Make sure that your machine entity has the proper inventory size.

## Shared JSON UI Controls

Bedrock Energistics Core provides some JSON UI controls that your UIs can use. Their source can be found [here](https://github.com/Fluffyalien1422/bedrock-energistics-core/blob/main/packs/RP/ui/fluffyalien/energisticscore/common.json) (you do not need to copy it into your add-on).

- `fluffyalien_energisticscore:common.container_title` - A label that can be used for your machine title. Define the text with the `text` property.
- `fluffyalien_energisticscore:common.container_item_slot` - An item slot. Set the slot index with the `$index` variable.
- `fluffyalien_energisticscore:common.container_item_slot_nobg` - An item slot with no background. Set the slot index with the `$index` variable.
- `fluffyalien_energisticscore:common.container_slot_icon` - An item slot for icons (such as progress indicators). This slot cannot be selected and has no background. Set the slot index with the `$index` variable.
- `fluffyalien_energisticscore:common.machine_storage_bar` - Four item slots placed vertically for storage bars. Set the starting slot index with the `$start_index` variable.

## Updating UI Elements

Machine definitions can have an `updateUi` handler. This is a function that is called regularly and returns an object defining the state of storage bars and progress indicators.

## Storage Bars

Storage bars indicate how much of a specific storage type are in the machine. These elements take up four slots. The storage type that each bar displays should be set using the `updateUi` handler. If the `updateUi` handler does not reference a storage bar, then it will show up as "Disabled".

## Progress Indicators

Progress indicators can be an arrow or a flame (the indicators from the Minecraft furnace). They take up one slot. The progress value should be set using the `updateUi` handler. Note that the minimum progress value is 0 and the maximum value varies depending on the indicator type.

Indicator max progress values:

- Arrow: 16
- Flame: 13

## Other Elements

Some elements are not listed here. Find more information on these elements in the reference documentation. All other elements use one slot.
