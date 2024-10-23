import * as mc from "@minecraft/server";

export interface BlockComponentTypeMap {
  inventory: mc.BlockInventoryComponent;
  "minecraft:inventory": mc.BlockInventoryComponent;
  "minecraft:piston": mc.BlockPistonComponent;
  "minecraft:record_player": mc.BlockRecordPlayerComponent;
  "minecraft:sign": mc.BlockSignComponent;
  piston: mc.BlockPistonComponent;
  record_player: mc.BlockRecordPlayerComponent;
  sign: mc.BlockSignComponent;
}

export interface EntityComponentTypeMap {
  addrider: mc.EntityAddRiderComponent;
  ageable: mc.EntityAgeableComponent;
  breathable: mc.EntityBreathableComponent;
  can_climb: mc.EntityCanClimbComponent;
  can_fly: mc.EntityCanFlyComponent;
  can_power_jump: mc.EntityCanPowerJumpComponent;
  color: mc.EntityColorComponent;
  color2: mc.EntityColor2Component;
  cursor_inventory: mc.PlayerCursorInventoryComponent;
  equippable: mc.EntityEquippableComponent;
  fire_immune: mc.EntityFireImmuneComponent;
  floats_in_liquid: mc.EntityFloatsInLiquidComponent;
  flying_speed: mc.EntityFlyingSpeedComponent;
  friction_modifier: mc.EntityFrictionModifierComponent;
  ground_offset: mc.EntityGroundOffsetComponent;
  healable: mc.EntityHealableComponent;
  health: mc.EntityHealthComponent;
  inventory: mc.EntityInventoryComponent;
  is_baby: mc.EntityIsBabyComponent;
  is_charged: mc.EntityIsChargedComponent;
  is_chested: mc.EntityIsChestedComponent;
  is_dyeable: mc.EntityIsDyeableComponent;
  is_hidden_when_invisible: mc.EntityIsHiddenWhenInvisibleComponent;
  is_ignited: mc.EntityIsIgnitedComponent;
  is_illager_captain: mc.EntityIsIllagerCaptainComponent;
  is_saddled: mc.EntityIsSaddledComponent;
  is_shaking: mc.EntityIsShakingComponent;
  is_sheared: mc.EntityIsShearedComponent;
  is_stackable: mc.EntityIsStackableComponent;
  is_stunned: mc.EntityIsStunnedComponent;
  is_tamed: mc.EntityIsTamedComponent;
  item: mc.EntityItemComponent;
  lava_movement: mc.EntityLavaMovementComponent;
  leashable: mc.EntityLeashableComponent;
  mark_variant: mc.EntityMarkVariantComponent;
  "minecraft:addrider": mc.EntityAddRiderComponent;
  "minecraft:ageable": mc.EntityAgeableComponent;
  "minecraft:breathable": mc.EntityBreathableComponent;
  "minecraft:can_climb": mc.EntityCanClimbComponent;
  "minecraft:can_fly": mc.EntityCanFlyComponent;
  "minecraft:can_power_jump": mc.EntityCanPowerJumpComponent;
  "minecraft:color": mc.EntityColorComponent;
  "minecraft:color2": mc.EntityColor2Component;
  "minecraft:cursor_inventory": mc.PlayerCursorInventoryComponent;
  "minecraft:equippable": mc.EntityEquippableComponent;
  "minecraft:fire_immune": mc.EntityFireImmuneComponent;
  "minecraft:floats_in_liquid": mc.EntityFloatsInLiquidComponent;
  "minecraft:flying_speed": mc.EntityFlyingSpeedComponent;
  "minecraft:friction_modifier": mc.EntityFrictionModifierComponent;
  "minecraft:ground_offset": mc.EntityGroundOffsetComponent;
  "minecraft:healable": mc.EntityHealableComponent;
  "minecraft:health": mc.EntityHealthComponent;
  "minecraft:inventory": mc.EntityInventoryComponent;
  "minecraft:is_baby": mc.EntityIsBabyComponent;
  "minecraft:is_charged": mc.EntityIsChargedComponent;
  "minecraft:is_chested": mc.EntityIsChestedComponent;
  "minecraft:is_dyeable": mc.EntityIsDyeableComponent;
  "minecraft:is_hidden_when_invisible": mc.EntityIsHiddenWhenInvisibleComponent;
  "minecraft:is_ignited": mc.EntityIsIgnitedComponent;
  "minecraft:is_illager_captain": mc.EntityIsIllagerCaptainComponent;
  "minecraft:is_saddled": mc.EntityIsSaddledComponent;
  "minecraft:is_shaking": mc.EntityIsShakingComponent;
  "minecraft:is_sheared": mc.EntityIsShearedComponent;
  "minecraft:is_stackable": mc.EntityIsStackableComponent;
  "minecraft:is_stunned": mc.EntityIsStunnedComponent;
  "minecraft:is_tamed": mc.EntityIsTamedComponent;
  "minecraft:item": mc.EntityItemComponent;
  "minecraft:lava_movement": mc.EntityLavaMovementComponent;
  "minecraft:leashable": mc.EntityLeashableComponent;
  "minecraft:mark_variant": mc.EntityMarkVariantComponent;
  "minecraft:movement": mc.EntityMovementComponent;
  "minecraft:movement.amphibious": mc.EntityMovementAmphibiousComponent;
  "minecraft:movement.basic": mc.EntityMovementBasicComponent;
  "minecraft:movement.fly": mc.EntityMovementFlyComponent;
  "minecraft:movement.generic": mc.EntityMovementGenericComponent;
  "minecraft:movement.glide": mc.EntityMovementGlideComponent;
  "minecraft:movement.hover": mc.EntityMovementHoverComponent;
  "minecraft:movement.jump": mc.EntityMovementJumpComponent;
  "minecraft:movement.skip": mc.EntityMovementSkipComponent;
  "minecraft:movement.sway": mc.EntityMovementSwayComponent;
  "minecraft:navigation.climb": mc.EntityNavigationClimbComponent;
  "minecraft:navigation.float": mc.EntityNavigationFloatComponent;
  "minecraft:navigation.fly": mc.EntityNavigationFlyComponent;
  "minecraft:navigation.generic": mc.EntityNavigationGenericComponent;
  "minecraft:navigation.hover": mc.EntityNavigationHoverComponent;
  "minecraft:navigation.walk": mc.EntityNavigationWalkComponent;
  "minecraft:onfire": mc.EntityOnFireComponent;
  "minecraft:projectile": mc.EntityProjectileComponent;
  "minecraft:push_through": mc.EntityPushThroughComponent;
  "minecraft:rideable": mc.EntityRideableComponent;
  "minecraft:riding": mc.EntityRidingComponent;
  "minecraft:scale": mc.EntityScaleComponent;
  "minecraft:skin_id": mc.EntitySkinIdComponent;
  "minecraft:strength": mc.EntityStrengthComponent;
  "minecraft:tameable": mc.EntityTameableComponent;
  "minecraft:tamemount": mc.EntityTameMountComponent;
  "minecraft:type_family": mc.EntityTypeFamilyComponent;
  "minecraft:underwater_movement": mc.EntityUnderwaterMovementComponent;
  "minecraft:variant": mc.EntityVariantComponent;
  "minecraft:wants_jockey": mc.EntityWantsJockeyComponent;
  movement: mc.EntityMovementComponent;
  "movement.amphibious": mc.EntityMovementAmphibiousComponent;
  "movement.basic": mc.EntityMovementBasicComponent;
  "movement.fly": mc.EntityMovementFlyComponent;
  "movement.generic": mc.EntityMovementGenericComponent;
  "movement.glide": mc.EntityMovementGlideComponent;
  "movement.hover": mc.EntityMovementHoverComponent;
  "movement.jump": mc.EntityMovementJumpComponent;
  "movement.skip": mc.EntityMovementSkipComponent;
  "movement.sway": mc.EntityMovementSwayComponent;
  "navigation.climb": mc.EntityNavigationClimbComponent;
  "navigation.float": mc.EntityNavigationFloatComponent;
  "navigation.fly": mc.EntityNavigationFlyComponent;
  "navigation.generic": mc.EntityNavigationGenericComponent;
  "navigation.hover": mc.EntityNavigationHoverComponent;
  "navigation.walk": mc.EntityNavigationWalkComponent;
  onfire: mc.EntityOnFireComponent;
  projectile: mc.EntityProjectileComponent;
  push_through: mc.EntityPushThroughComponent;
  rideable: mc.EntityRideableComponent;
  riding: mc.EntityRidingComponent;
  scale: mc.EntityScaleComponent;
  skin_id: mc.EntitySkinIdComponent;
  strength: mc.EntityStrengthComponent;
  tameable: mc.EntityTameableComponent;
  tamemount: mc.EntityTameMountComponent;
  type_family: mc.EntityTypeFamilyComponent;
  underwater_movement: mc.EntityUnderwaterMovementComponent;
  variant: mc.EntityVariantComponent;
  wants_jockey: mc.EntityWantsJockeyComponent;
}

/**
 * @beta
 */
export interface ItemComponentTypeMap {
  cooldown: mc.ItemCooldownComponent;
  durability: mc.ItemDurabilityComponent;
  enchantable: mc.ItemEnchantableComponent;
  food: mc.ItemFoodComponent;
  "minecraft:cooldown": mc.ItemCooldownComponent;
  "minecraft:durability": mc.ItemDurabilityComponent;
  "minecraft:enchantable": mc.ItemEnchantableComponent;
  "minecraft:food": mc.ItemFoodComponent;
}

export function getBlockComponent<T extends keyof BlockComponentTypeMap>(
  block: mc.Block,
  componentId: T,
): BlockComponentTypeMap[T] | undefined {
  return block.getComponent(componentId) as
    | BlockComponentTypeMap[T]
    | undefined;
}

export function getEntityComponent<T extends keyof EntityComponentTypeMap>(
  entity: mc.Entity,
  componentId: T,
): EntityComponentTypeMap[T] | undefined {
  return entity.getComponent(componentId) as
    | EntityComponentTypeMap[T]
    | undefined;
}

export function getItemComponent<T extends keyof ItemComponentTypeMap>(
  item: mc.ItemStack,
  componentId: T,
): ItemComponentTypeMap[T] | undefined {
  return item.getComponent(componentId) as ItemComponentTypeMap[T] | undefined;
}
