import { Block, Dimension, Entity, Vector3 } from "@minecraft/server";
import {
  NETWORK_LINK_BLOCK_TAG,
  NETWORK_LINK_ENTITY_ID,
  NetworkLinkAddRequest,
  NetworkLinkDestroyRequest,
  NetworkLinkGetRequest,
  NetworkLinkGetResponse,
} from "./ipc_events.js";
import { makeSerializableDimensionLocation } from "../serialize_utils.js";
import { raise } from "../log.js";
import { ipcInvoke } from "../ipc_wrapper.js";

/**
 * A network link node in a machine network.
 * @beta
 * @remarks
 * NetworkLinkNodes can be used to combine two seperate networks without any physcical connection between them.
 */
export class NetworkLinkNode {
  private readonly entity: Entity;
  private readonly blockPos: Vector3;

  private constructor(entity: Entity, blockPos: Vector3) {
    this.entity = entity;
    this.blockPos = blockPos;
  }

  /**
   * Fetches all of the outbound connections to other {@link NetworkLinkNode}s
   * @returns The block positions of each connection
   * @beta
   */
  public async getConnections(): Promise<Vector3[]> {
    const payload: NetworkLinkGetRequest = {
      self: makeSerializableDimensionLocation({
        dimension: this.entity.dimension,
        ...this.blockPos,
      }),
    };

    const res = (await ipcInvoke(
      "fluffyalien_energisticscore:ipc.networkLinkGet",
      payload,
    )) as NetworkLinkGetResponse;

    return res.locations;
  }

  /**
   * Sends a request to create a two way connection between this {@link NetworkLinkNode} and the location of another.
   * @param location The block location of the other node.
   * @beta
   */
  public async addConnection(location: Vector3): Promise<void> {
    const payload: NetworkLinkAddRequest = {
      self: makeSerializableDimensionLocation({
        dimension: this.entity.dimension,
        ...this.blockPos,
      }),
      other: location,
    };

    await ipcInvoke("fluffyalien_energisticscore:ipc.networkLinkAdd", payload);
  }

  /**
   * Sends a request to break an existing two way connection between this {@link NetworkLinkNode} and the location of another.
   * @param location The block location of the other node.
   * @beta
   */
  public async removeConnection(location: Vector3): Promise<void> {
    const payload: NetworkLinkAddRequest = {
      self: makeSerializableDimensionLocation({
        dimension: this.entity.dimension,
        ...this.blockPos,
      }),
      other: location,
    };

    await ipcInvoke(
      "fluffyalien_energisticscore:ipc.networkLinkRemove",
      payload,
    );
  }

  /**
   * Sends a request to break all connections and clean-up the backend side.
   * @beta
   */
  public async destroyNode(): Promise<void> {
    const payload: NetworkLinkDestroyRequest = {
      self: makeSerializableDimensionLocation({
        dimension: this.entity.dimension,
        ...this.blockPos,
      }),
    };

    await ipcInvoke(
      "fluffyalien_energisticscore:ipc.networkLinkDestroy",
      payload,
    );
  }

  /**
   * Returns the internal entity being used for this network link node
   * - Can be used to stash additional data by other packs.
   * @beta
   */
  public getInternalEntity(): Entity {
    return this.entity;
  }

  /**
   * Finds the `NetworkLinkNode` associated with this block, or creates it if it doesn't exist
   *
   * @param block Expected to have the `fluffyalien_energisticscore:network_link` block tag
   * @returns The `NetworkLinkNode` at the block location
   * @throws When the `NetworkLinkNode` does not exist yet, and the block at this location does not have the correct tags
   * @beta
   */
  static get(block: Block): NetworkLinkNode {
    let dataStorageEntity = block.dimension
      .getEntitiesAtBlockLocation(block.location)
      .find((e) => e.typeId === NETWORK_LINK_ENTITY_ID);

    // Only verify the block tag when creating an entity, this is easier for after events when the network link block
    // is destroyed, but we still need to get it to cleanup.
    if (!dataStorageEntity && !block.hasTag(NETWORK_LINK_BLOCK_TAG))
      raise(
        `NetworkLinkNode.get expected block of id: '${block.typeId}' to have the '${NETWORK_LINK_BLOCK_TAG}' tag before creating a network link storage entity at this location`,
      );

    // Spawn entity if tag check passed and it is null.
    dataStorageEntity ??= block.dimension.spawnEntity(
      NETWORK_LINK_ENTITY_ID,
      block.center(),
    );
    return new NetworkLinkNode(dataStorageEntity, block.location);
  }

  /**
   * Finds the `NetworkLinkNode` associated with this location, or undefined if it does not exist yet
   * @param dimension The dimension the block is in
   * @param location The location of the block
   * @returns The associated `NetworkLinkNode` or `undefined` if it does not exist
   * @beta
   */
  static tryGetAt(
    dimension: Dimension,
    location: Vector3,
  ): NetworkLinkNode | undefined {
    const dataStorageEntity = dimension
      .getEntitiesAtBlockLocation(location)
      .find((e) => e.typeId === NETWORK_LINK_ENTITY_ID);

    if (dataStorageEntity === undefined) return undefined;
    return new NetworkLinkNode(dataStorageEntity, location);
  }
}
