import { Block, DimensionLocation } from "@minecraft/server";
import {
  NetworkGetAllWithPayload,
  NetworkInstanceMethodPayload,
  NetworkIsPartOfNetworkPayload,
  NetworkQueueSendPayload,
  NetworkEstablishPayload,
  NetworkGetWithPayload,
  NetworkDataPayload,
} from "./network_internal.js";
import { DIRECTION_VECTORS } from "./misc_internal.js";
import { Vector3Utils } from "@minecraft/math";
import {
  getBlockNetworkConnectionType,
  NetworkConnectionType,
} from "./network_utils.js";
import { makeSerializableDimensionLocation } from "./serialize_utils.js";
import { ipcInvoke, ipcSend } from "./ipc_wrapper.js";
import { BecIpcListener } from "./bec_ipc_listener.js";
import { NetworkStorageTypeData } from "./machine_registry_types.js";
import { StorageTypeData } from "./storage_type_registry.js";

/**
 * A network of machines with a certain I/O type.
 * @beta
 */
export class MachineNetwork {
  /**
   * @private
   */
  private constructor(
    /**
     * Unique ID for this network.
     * @beta
     */
    readonly id: number,

    /**
     * The I/O type of this network.
     * @beta
     */
    readonly ioType: Readonly<StorageTypeData>,
  ) {}

  /**
   * @internal
   */
  private static fromDataPayload(data: NetworkDataPayload): MachineNetwork {
    return new MachineNetwork(data.id, data.ioType);
  }

  /**
   * Destroy this object.
   * This will force a new network to be established if any of the machines inside it still exist.
   * Use this function to force network updates.
   * @see {@link MachineNetwork.updateAdjacent}, {@link MachineNetwork.updateWith}, {@link MachineNetwork.updateWithBlock}
   * @beta
   * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidState} if this package has not been initialized (see {@link init}).
   */
  destroy(): void {
    const payload: NetworkInstanceMethodPayload = {
      networkId: this.id,
    };

    ipcSend(BecIpcListener.DestroyNetwork, payload);
  }

  /**
   * Get the statistics from the latest network allocation.
   * @beta
   * @remarks
   * Contains statistics about each storage type's availability on the network before and after distribution,
   * as of the latest network allocation. This is equivalent to the data passed to the `onNetworkAllocationCompleted`
   * machine event.
   * @returns Statistics about this network's storage type before and after the latest distribution.
   * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidState} if this package has not been initialized (see {@link init}).
   */
  async getLatestAllocationData(): Promise<NetworkStorageTypeData> {
    const payload: NetworkInstanceMethodPayload = {
      networkId: this.id,
    };

    const response = await ipcInvoke<NetworkStorageTypeData | null>(
      BecIpcListener.GetNetworkStats,
      payload,
    );

    return response ?? { before: 0, after: 0 };
  }

  /**
   * Tests if a machine matching the arguments is inside of this network.
   * @beta
   * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidState} if this package has not been initialized (see {@link init}).
   */
  isPartOfNetwork(
    location: DimensionLocation,
    type: NetworkConnectionType,
  ): Promise<boolean> {
    const payload: NetworkIsPartOfNetworkPayload = {
      networkId: this.id,
      loc: makeSerializableDimensionLocation(location),
      type,
    };

    return ipcInvoke<boolean>(BecIpcListener.IsPartOfNetwork, payload);
  }

  /**
   * Tests if a block is inside of this network.
   * @beta
   * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidState} if this package has not been initialized (see {@link init}).
   */
  async isBlockPartOfNetwork(block: Block): Promise<boolean> {
    const type = getBlockNetworkConnectionType(block);
    if (type === undefined) return false;
    return this.isPartOfNetwork(block, type);
  }

  /**
   * Queue sending a storage type over this machine network.
   * @beta
   * @remarks
   * - Note: in most cases, prefer {@link generate} over this function.
   * - Automatically sets the machine's reserve storage to the amount that was not received.
   * @param blockLocation The location of the machine that is sending the storage type.
   * @param amount The amount to send. Must be greater than zero.
   * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidState} if this package has not been initialized (see {@link init}).
   * @see {@link generate}
   */
  queueSend(blockLocation: DimensionLocation, amount: number): void {
    const payload: NetworkQueueSendPayload = {
      networkId: this.id,
      loc: makeSerializableDimensionLocation(blockLocation),
      amount,
    };

    ipcSend(BecIpcListener.NetworkQueueSend, payload);
  }

  /**
   * Establish a new network at `location`.
   * @beta
   * @throws Throws a {@link PublicError} of type {@link PublicErrorType.NotRegistered} if the storage type does not exist.
   * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidState} if this package has not been initialized (see {@link init}).
   */
  static async establish(
    ioTypeId: string,
    location: DimensionLocation,
  ): Promise<MachineNetwork | undefined> {
    const payload: NetworkEstablishPayload = {
      ioTypeId,
      location: makeSerializableDimensionLocation(location),
    };

    const data = await ipcInvoke<NetworkDataPayload | null>(
      BecIpcListener.EstablishNetwork,
      payload,
    );

    if (data !== null) {
      return MachineNetwork.fromDataPayload(data);
    }
  }

  /**
   * Get the {@link MachineNetwork} that contains a machine that matches the arguments.
   * @param ioTypeId the I/O type of the network.
   * @param location The location of the machine.
   * @param connectionType The connection type of the machine.
   * @beta
   * @throws Throws a {@link PublicError} of type {@link PublicErrorType.NotRegistered} if the storage type does not exist.
   * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidState} if this package has not been initialized (see {@link init}).
   */
  static async getWith(
    ioTypeId: string,
    location: DimensionLocation,
    connectionType: NetworkConnectionType,
  ): Promise<MachineNetwork | undefined> {
    const payload: NetworkGetWithPayload = {
      ioTypeId,
      connectionType,
      location: makeSerializableDimensionLocation(location),
    };

    const data = await ipcInvoke<NetworkDataPayload | null>(
      BecIpcListener.GetNetworkWith,
      payload,
    );

    if (data !== null) {
      return MachineNetwork.fromDataPayload(data);
    }
  }

  /**
   * Get the {@link MachineNetwork} that contains a block.
   * @beta
   * @throws Throws a {@link PublicError} of type {@link PublicErrorType.NotRegistered} if the storage type does not exist.
   * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidState} if this package has not been initialized (see {@link init}).
   */
  static async getWithBlock(
    ioTypeId: string,
    block: Block,
  ): Promise<MachineNetwork | undefined> {
    const type = getBlockNetworkConnectionType(block);
    if (type === undefined) return;
    return MachineNetwork.getWith(ioTypeId, block, type);
  }

  /**
   * Get all {@link MachineNetwork}s that contain a machine that matches the arguments.
   * @beta
   * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidState} if this package has not been initialized (see {@link init}).
   */
  static async getAllWith(
    location: DimensionLocation,
    type: NetworkConnectionType,
  ): Promise<MachineNetwork[]> {
    const payload: NetworkGetAllWithPayload = {
      loc: makeSerializableDimensionLocation(location),
      type,
    };

    // An unexpected error in the core pack is logged there and answered with
    // `null`, so default to an empty list rather than dereferencing it.
    const networks =
      (await ipcInvoke<NetworkDataPayload[] | null>(
        BecIpcListener.GetAllNetworksWith,
        payload,
      )) ?? [];

    return networks.map((network) => MachineNetwork.fromDataPayload(network));
  }

  /**
   * Get all {@link MachineNetwork}s that contain a block.
   * @beta
   * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidState} if this package has not been initialized (see {@link init}).
   */
  static async getAllWithBlock(block: Block): Promise<MachineNetwork[]> {
    const type = getBlockNetworkConnectionType(block);
    if (type === undefined) return [];
    return MachineNetwork.getAllWith(block, type);
  }

  /**
   * Get the {@link MachineNetwork} that contains a block if it exists,
   * otherwise establish a network using the block as the origin if it doesn't exist.
   * @see {@link MachineNetwork.getWithBlock}, {@link MachineNetwork.establish}
   * @beta
   * @throws Throws a {@link PublicError} of type {@link PublicErrorType.NotRegistered} if the storage type does not exist.
   * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidState} if this package has not been initialized (see {@link init}).
   */
  static async getOrEstablish(
    ioTypeId: string,
    location: DimensionLocation,
  ): Promise<MachineNetwork | undefined> {
    // this can be done without a dedicated script event handler,
    // but invoking one handler is faster than two

    const payload: NetworkEstablishPayload = {
      ioTypeId,
      location: makeSerializableDimensionLocation(location),
    };

    const data = await ipcInvoke<NetworkDataPayload | null>(
      BecIpcListener.GetOrEstablishNetwork,
      payload,
    );

    if (data !== null) {
      return MachineNetwork.fromDataPayload(data);
    }
  }

  /**
   * Update all {@link MachineNetwork}s adjacent to a location.
   * @beta
   * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidState} if this package has not been initialized (see {@link init}).
   */
  static async updateAdjacent(location: DimensionLocation): Promise<void> {
    for (const directionVector of DIRECTION_VECTORS) {
      const blockInDirection = location.dimension.getBlock(
        Vector3Utils.add(location, directionVector),
      );
      if (!blockInDirection) {
        continue;
      }

      for (const network of await MachineNetwork.getAllWithBlock(
        blockInDirection,
      )) {
        network.destroy();
      }
    }
  }

  /**
   * Update all {@link MachineNetwork}s that contain a machine that matches the arguments.
   * @beta
   * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidState} if this package has not been initialized (see {@link init}).
   */
  static async updateWith(
    location: DimensionLocation,
    type: NetworkConnectionType,
  ): Promise<void> {
    for (const network of await MachineNetwork.getAllWith(location, type)) {
      network.destroy();
    }
  }

  /**
   * Update all {@link MachineNetwork}s that contain a block.
   * @beta
   * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidState} if this package has not been initialized (see {@link init}).
   */
  static async updateWithBlock(block: Block): Promise<void> {
    for (const network of await MachineNetwork.getAllWithBlock(block)) {
      network.destroy();
    }
  }
}
