import {
  NETWORK_LINK_BLOCK_TAG,
  NETWORK_LINK_ENTITY_ID,
  NETWORK_LINK_POSITIONS_KEY,
} from "@/public_api/src/network_links/ipc_events";
import { Vector3Utils } from "@minecraft/math";
import { Block, Dimension, Entity, Vector3 } from "@minecraft/server";
import { raise } from "../utils/log";
import { MachineNetwork } from "../network";

/**
 * Internal version of the `NetworkLinkNode` class
 * @remarks
 * There is a difference between the public api facing class since, all entity properties
 * have to be accessed and created from the core pack, since they get sandboxed.
 */
export class InternalNetworkLinkNode {
  private readonly entity: Entity;
  private readonly blockPos: Vector3;

  private constructor(entity: Entity, blockPos: Vector3) {
    this.entity = entity;
    this.blockPos = blockPos;
  }

  public static fromEntity(entity: Entity): InternalNetworkLinkNode {
    return new InternalNetworkLinkNode(entity, entity.location);
  }

  /**
   * Gets the link node for a block, spawning its backing data entity if one
   * doesn't exist yet. The entity is what persists the node's connections.
   */
  public static fromBlock(block: Block): InternalNetworkLinkNode {
    let dataStorageEntity = block.dimension
      .getEntitiesAtBlockLocation(block.location)
      .find((e) => e.typeId === NETWORK_LINK_ENTITY_ID);

    // Only verify the block tag when creating an entity, this is easier for after events when the network link block
    // is destroyed, but we still need to get it to cleanup.
    if (!dataStorageEntity && !block.hasTag(NETWORK_LINK_BLOCK_TAG))
      raise(
        `NetworkLinks::getNetworkLink expected block of id: '${block.typeId}' to have the '${NETWORK_LINK_BLOCK_TAG}' tag before creating a network link storage entity at this location`,
      );

    // Spawn entity if tag check passed and it is null.
    dataStorageEntity ??= block.dimension.spawnEntity(
      NETWORK_LINK_ENTITY_ID,
      block.location,
    );
    return new InternalNetworkLinkNode(dataStorageEntity, block.location);
  }

  /**
   * Gets the link node at a location, or `undefined` if there is no backing
   * entity there. Unlike {@link InternalNetworkLinkNode.fromBlock}, never
   * spawns one - use when the node may legitimately not exist.
   */
  public static tryGetAt(
    dimension: Dimension,
    location: Vector3,
  ): InternalNetworkLinkNode | undefined {
    const dataStorageEntity = dimension
      .getEntitiesAtBlockLocation(location)
      .find((e) => e.typeId === NETWORK_LINK_ENTITY_ID);

    if (dataStorageEntity === undefined) return undefined;
    return new InternalNetworkLinkNode(dataStorageEntity, location);
  }

  /** The positions this node links to, decoded from the entity's storage. */
  public getConnections(): Vector3[] {
    this.ensureValid();
    const rawData = this.entity.getDynamicProperty(
      NETWORK_LINK_POSITIONS_KEY,
    ) as string | undefined;
    return JSON.parse(rawData ?? "[]") as Vector3[];
  }

  /**
   * Links this node to another, writing the connection on *both* nodes (links
   * are two-way), then rebuilds the networks of both ends so the new link takes
   * effect.
   */
  public addConnection(location: Vector3): void {
    const otherBlock = this.entity.dimension.getBlock(location);
    if (!otherBlock) {
      raise(
        `Failed to add network link connection: the target block at ${Vector3Utils.toString(location)} is not loaded.`,
      );
    }
    const other = InternalNetworkLinkNode.fromBlock(otherBlock);

    other.selfAddConnection(this.blockPos);
    this.selfAddConnection(other.blockPos);

    const thisBlock = this.entity.dimension.getBlock(this.blockPos);
    if (thisBlock) MachineNetwork.updateWithBlock(thisBlock);
    MachineNetwork.updateWithBlock(otherBlock);
  }

  /** Inverse of {@link InternalNetworkLinkNode.addConnection}. */
  public removeConnection(location: Vector3): void {
    const otherBlock = this.entity.dimension.getBlock(location);
    if (!otherBlock) {
      raise(
        `Failed to remove network link connection: the target block at ${Vector3Utils.toString(location)} is not loaded.`,
      );
    }
    const other = InternalNetworkLinkNode.fromBlock(otherBlock);

    other.selfRemoveConnection(this.blockPos);
    this.selfRemoveConnection(other.blockPos);

    const thisBlock = this.entity.dimension.getBlock(this.blockPos);
    if (thisBlock) MachineNetwork.updateWithBlock(thisBlock);
    MachineNetwork.updateWithBlock(otherBlock);
  }

  /**
   * Tears down this node: removes it from every node it links to (so no dangling
   * one-way links remain), then removes its backing entity.
   */
  public destroyNode(): void {
    const outboundConnections = this.getConnections();

    // links are two way, remove the inbound links to this block.
    for (const connection of outboundConnections) {
      const block = this.entity.dimension.getBlock(connection);
      // If the partner's chunk is unloaded we can't clean up its side right now;
      // skip it (leaving a transient one-way link that the next network rebuild
      // at that location resolves) rather than throwing and orphaning this
      // node's backing entity, which must still be removed below.
      if (!block) continue;
      const node = InternalNetworkLinkNode.fromBlock(block);
      node.removeConnection(this.blockPos);
    }

    this.entity.remove();
  }

  public isValid(): boolean {
    return this.entity.isValid;
  }

  // The `self*` helpers update only this node's stored connections (one side of
  // the two-way link). The public add/removeConnection methods call them on
  // both ends to keep the two directions consistent.

  private selfRemoveConnection(location: Vector3): void {
    const filtered = this.getConnections().filter(
      (outbound) => !Vector3Utils.equals(outbound, location),
    );
    this.selfSerializeConnections(filtered);
  }

  private selfAddConnection(location: Vector3): void {
    this.selfSerializeConnections([...this.getConnections(), location]);
  }

  private selfSerializeConnections(connections: Vector3[]): void {
    this.ensureValid();
    this.entity.setDynamicProperty(
      NETWORK_LINK_POSITIONS_KEY,
      JSON.stringify(connections),
    );
  }

  private ensureValid(): void {
    if (!this.entity.isValid) raise(`NetworkLinkNode instance is not valid.`);
  }
}
