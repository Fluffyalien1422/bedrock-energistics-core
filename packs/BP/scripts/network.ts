import {
  Block,
  Dimension,
  DimensionLocation,
  Vector3,
  system,
} from "@minecraft/server";
import { Vector3Utils } from "@minecraft/math";
import { DestroyableObject } from "./utils/destroyable";
import { logWarn } from "./utils/log";
import { getMachineStorage, setMachineStorage } from "./data";
import {
  DIRECTION_VECTORS,
  getBlockInDirection,
  StrDirection,
} from "./utils/direction";
import { InternalNetworkLinkNode } from "./network_links/network_link_internal";
import {
  getBlockNetworkConnectionType,
  NetworkConnectionType,
  NetworkStorageTypeData,
} from "@/public_api/src";
import { InternalRegisteredMachine } from "./machine_registry";

interface SendQueueItem {
  block: Block;
  amount: number;
  type: string;
}

interface NetworkConnections {
  conduits: Block[];
  machines: Block[];
  networkLinks: Block[];
}

let totalNetworkCount = 0; // used to create a unique id
const networks = new Map<number, MachineNetwork>();

/**
 * A network of machines with a certain I/O category.
 */
export class MachineNetwork extends DestroyableObject {
  private sendJobRunning = false;
  private sendQueue: SendQueueItem[] = [];
  private readonly intervalId: number;

  /**
   * Unique ID for this network.
   */
  readonly id: number;

  constructor(
    /**
     * The I/O category of this network.
     */
    readonly category: string,
    /**
     * This network's dimension.
     */
    readonly dimension: Dimension,
    private readonly connections: NetworkConnections,
  ) {
    super();

    this.id = totalNetworkCount;
    networks.set(this.id, this);
    totalNetworkCount++;

    this.intervalId = system.runInterval(() => {
      if (this.sendJobRunning || !this.sendQueue.length) return;
      this.sendJobRunning = true;
      system.runJob(this.send());
    }, 2);
  }

  /**
   * Destroy this object.
   * This will force a new network to be established if any of the machines inside it still exist.
   * Use this function to force network updates.
   * @see {@link MachineNetwork.updateAdjacent}, {@link MachineNetwork.updateWith}, {@link MachineNetwork.updateWithBlock}
   */
  destroy(): void {
    super.destroy();
    system.clearRun(this.intervalId);
    networks.delete(this.id);
  }

  /**
   * processes the `sendQueue`. sends storage types to the consumers in the network starting
   * with the ones with the least stored.
   * automatically sets each generator's storage to the amount it sent that was not received.
   * returns automatically if the object is not valid.
   */
  private *send(): Generator<void, void, void> {
    if (!this.isValid) return;

    interface DistributionData {
      total: number;
      queueItems: SendQueueItem[];
    }

    // Calculate the amount of each type that is available to send around.
    const distribution: Record<string, DistributionData> = {};

    for (const send of this.sendQueue) {
      if (send.type in distribution) {
        const data = distribution[send.type];
        data.total += send.amount;
        data.queueItems.push(send);
        continue;
      }

      distribution[send.type] = {
        total: send.amount,
        queueItems: [send],
      };
    }

    this.sendQueue = [];

    const typesToDistribute = Object.keys(distribution);

    interface ConsumerGroups {
      normalPriority: Block[];
      lowPriority: Block[];
    }

    // initialize consumers keys.
    const consumers: Record<string, ConsumerGroups> = {};
    const networkStatListeners: [Block, InternalRegisteredMachine][] = [];

    for (const key of typesToDistribute) {
      consumers[key] = { lowPriority: [], normalPriority: [] };
    }

    // find and filter connections into their consumer groups.
    for (const machine of this.connections.machines) {
      const isLowPriority = machine.hasTag(
        "fluffyalien_energisticscore:low_priority_consumer",
      );
      const allowsAny = machine.hasTag(
        "fluffyalien_energisticscore:consumer._any",
      );

      // Check machine tags and sort into appropriate groups.
      for (const consumerType of typesToDistribute) {
        const allowsType =
          allowsAny ||
          machine.hasTag(
            `fluffyalien_energisticscore:consumer.${consumerType}`,
          );
        if (!allowsType) continue;

        if (isLowPriority) consumers[consumerType].lowPriority.push(machine);
        else consumers[consumerType].normalPriority.push(machine);
      }

      // Check if the machine is listening for network stat events.
      const machineDef = InternalRegisteredMachine.forceGetInternal(
        machine.typeId,
      );

      if (machineDef.onNetworkStatsRecievedEvent) {
        networkStatListeners.push([machine, machineDef]);
      }
    }

    const networkStats: Record<string, NetworkStorageTypeData> = {};

    // send each machine its share of the pool.
    for (const type of typesToDistribute) {
      const machines = consumers[type];

      const distributionData = distribution[type];
      const originalBudget = distributionData.total;
      let budget = originalBudget;

      // Give each machine in the normal priority an equal split of the budget
      // Machines can consume less than they're offered in which case the savings are given to further machines.
      for (let i = 0; i < machines.normalPriority.length; i++) {
        const machine = machines.normalPriority[i];
        const budgetAllocation = Math.floor(
          budget / (machines.normalPriority.length - i),
        );
        const currentStored = getMachineStorage(machine, type);
        const machineDef = InternalRegisteredMachine.forceGetInternal(
          machine.typeId,
        );

        let amountToAllocate: number = Math.min(
          budgetAllocation,
          machineDef.maxStorage - currentStored,
        );

        let waiting = true;

        this.determineActualMachineAllocation(
          machine,
          machineDef,
          type,
          amountToAllocate,
        )
          .then((v) => (amountToAllocate = v))
          .catch((e: unknown) => {
            logWarn(
              `Error in determineActualMachineAllocation for id: ${machineDef.id}, error: ${JSON.stringify(e)}`,
            );
            amountToAllocate = 0;
          })
          .finally(() => {
            waiting = false;
          });

        while (waiting as boolean) yield;

        // finally give the machine its allocated share
        budget -= amountToAllocate;
        setMachineStorage(machine, type, currentStored + amountToAllocate);
        if (budget <= 0) break;
        yield;
      }

      // Give each machine in the low priority a split of the leftover budget (if applicable)
      if (budget >= 0) {
        for (let i = 0; i < machines.lowPriority.length; i++) {
          const machine = machines.lowPriority[i];
          const budgetAllocation = Math.floor(
            budget / (machines.lowPriority.length - i),
          );
          const currentStored = getMachineStorage(machine, type);
          const machineDef = InternalRegisteredMachine.forceGetInternal(
            machine.typeId,
          );

          let amountToAllocate: number = Math.min(
            budgetAllocation,
            machineDef.maxStorage - currentStored,
          );

          let waiting = true;

          this.determineActualMachineAllocation(
            machine,
            machineDef,
            type,
            amountToAllocate,
          )
            .then((v) => (amountToAllocate = v))
            .catch((e: unknown) => {
              logWarn(
                `Error in determineActualMachineAllocation for id: ${machineDef.id}, error: ${JSON.stringify(e)}`,
              );
              amountToAllocate = 0;
            })
            .finally(() => {
              waiting = false;
            });

          while (waiting as boolean) yield;

          // finally give the machine its allocated share
          budget -= amountToAllocate;
          setMachineStorage(machine, type, currentStored + amountToAllocate);
          if (budget <= 0) break;
          yield;
        }
      }

      networkStats[type] = {
        before: originalBudget,
        after: budget,
      };

      // return unused storage to generators
      for (let i = 0; i < distributionData.queueItems.length; i++) {
        const sendData = distributionData.queueItems[i];

        const machine = sendData.block;
        const budgetAllocation = Math.floor(
          budget / (distributionData.queueItems.length - i),
        );

        const machineDef = InternalRegisteredMachine.forceGetInternal(
          machine.typeId,
        );

        const newAmount = Math.min(
          budgetAllocation,
          machineDef.maxStorage,
          sendData.amount,
        );

        // finally give the machine its allocated share
        budget -= newAmount;
        setMachineStorage(machine, type, newAmount);
        if (budget <= 0) break;
        yield;
      }
    }

    for (const [block, machineDef] of networkStatListeners) {
      machineDef.callOnNetworkStatsRecievedEvent(block, networkStats);
    }

    this.sendJobRunning = false;
  }

  /**
   * invoke the 'recieve' handler on a machine to get the
   * actual allocation of a storage type (the 'recieve' handler
   * may override the amount a machine is supposed to recieve)
   */
  private async determineActualMachineAllocation(
    machine: Block,
    machineDef: InternalRegisteredMachine,
    type: string,
    amount: number,
  ): Promise<number> {
    // Allow the machine to change how much of its allocation it chooses to take
    if (machineDef.recieveHandlerEvent) {
      return machineDef.invokeRecieveHandler(machine, type, amount);
    }

    // if no handler, give it everything in its allocation
    return amount;
  }

  /**
   * Tests if a machine matching the arguments is inside of this network.
   * @throws if this object is not valid
   */
  isPartOfNetwork(
    location: DimensionLocation,
    type: NetworkConnectionType,
  ): boolean {
    this.ensureValidity();

    if (location.dimension.id !== this.dimension.id) return false;

    const condition = (other: Block): boolean =>
      Vector3Utils.equals(location, other.location);

    if (type === NetworkConnectionType.Conduit) {
      return this.connections.conduits.some(condition);
    }

    if (type === NetworkConnectionType.NetworkLink) {
      return this.connections.networkLinks.some(condition);
    }

    return this.connections.machines.some(condition);
  }

  /**
   * Tests if a block is inside of this network
   * @throws if this object is not valid
   */
  isBlockPartOfNetwork(block: Block): boolean {
    const type = getBlockNetworkConnectionType(block);
    if (!type) return false;
    return this.isPartOfNetwork(block, type);
  }

  queueSend(block: Block, type: string, amount: number): void {
    if (amount <= 0) return;
    this.sendQueue.push({ block, type, amount: Math.floor(amount) });
  }

  private static discoverConnections(
    origin: Block,
    category: string,
  ): NetworkConnections {
    const connections: NetworkConnections = {
      conduits: [],
      machines: [],
      networkLinks: [],
    };

    const stack: Block[] = [];
    const visitedLocations: Vector3[] = [];

    function handleNetworkLink(block: Block): void {
      connections.networkLinks.push(block);

      const netLink = InternalNetworkLinkNode.tryGetAt(
        block.dimension,
        block.location,
      );
      if (!netLink) return;

      const linkedPositions = netLink.getConnections();

      for (const pos of linkedPositions) {
        const linkedBlock = block.dimension.getBlock(pos);
        if (
          linkedBlock === undefined ||
          visitedLocations.some((v) => Vector3Utils.equals(v, pos))
        ) continue;
        handleBlock(linkedBlock);
      }
    }

    function handleBlock(block: Block): void {
      stack.push(block);
      visitedLocations.push(block.location);

      if (block.hasTag("fluffyalien_energisticscore:conduit")) {
        connections.conduits.push(block);
        return;
      }

      if (block.hasTag("fluffyalien_energisticscore:network_link")) {
        handleNetworkLink(block);
      }

      if (block.hasTag("fluffyalien_energisticscore:machine")) {
        connections.machines.push(block);
      }
      return;
    }

    function next(currentBlock: Block, direction: StrDirection): void {
      const nextBlock = getBlockInDirection(currentBlock, direction);
      if (!nextBlock) return;

      const isHandled = visitedLocations.some((l) =>
        Vector3Utils.equals(l, nextBlock.location),
      );
      if (isHandled) return;

      const isSameCategory = nextBlock.hasTag(
        `fluffyalien_energisticscore:io.${category}`,
      );
      const allowsAny = nextBlock.hasTag("fluffyalien_energisticscore:io._any");

      if (isSameCategory || allowsAny) handleBlock(nextBlock);
    }

    handleBlock(origin);

    while (stack.length) {
      const block = stack.pop()!;
      next(block, "north");
      next(block, "east");
      next(block, "south");
      next(block, "west");
      next(block, "up");
      next(block, "down");
    }

    return connections;
  }

  /**
   * Establish a new network at `location`.
   */
  static establish(category: string, block: Block): MachineNetwork | undefined {
    const connections = MachineNetwork.discoverConnections(block, category);
    if (!connections.machines.length) {
      return;
    }

    return new MachineNetwork(category, block.dimension, connections);
  }

  static getFromId(id: number): MachineNetwork | undefined {
    return networks.get(id);
  }

  /**
   * Get the {@link MachineNetwork} that contains a machine that matches the arguments.
   * @param category the category of the network.
   */
  static getWith(
    category: string,
    location: DimensionLocation,
    type: NetworkConnectionType,
  ): MachineNetwork | undefined {
    return [...networks.values()].find(
      (network) =>
        network.category === category &&
        network.isPartOfNetwork(location, type),
    );
  }

  /**
   * Get the {@link MachineNetwork} that contains a block.
   */
  static getWithBlock(
    category: string,
    block: Block,
  ): MachineNetwork | undefined {
    const type = getBlockNetworkConnectionType(block);
    if (!type) return;
    return MachineNetwork.getWith(category, block, type);
  }

  /**
   * Get all {@link MachineNetwork}s that contain a machine that matches the arguments.
   */
  static getAllWith(
    location: DimensionLocation,
    type: NetworkConnectionType,
  ): MachineNetwork[] {
    return [...networks.values()].filter((network) =>
      network.isPartOfNetwork(location, type),
    );
  }

  /**
   * Get all {@link MachineNetwork}s that contain a block.
   */
  static getAllWithBlock(block: Block): MachineNetwork[] {
    const type = getBlockNetworkConnectionType(block);
    if (!type) return [];
    return MachineNetwork.getAllWith(block, type);
  }

  /**
   * Get the {@link MachineNetwork} that contains a block if it exists,
   * otherwise establish a network using the block as the origin if it doesn't exist.
   * @see {@link MachineNetwork.getWithBlock}, {@link MachineNetwork.establish}
   */
  static getOrEstablish(
    category: string,
    block: Block,
  ): MachineNetwork | undefined {
    return (
      MachineNetwork.getWithBlock(category, block) ??
      MachineNetwork.establish(category, block)
    );
  }

  /**
   * Update all {@link MachineNetwork}s adjacent to a location.
   * @param categories Only update networks of these I/O categories. If this is `undefined` then all adjacent networks will be updated.
   */
  static updateAdjacent(
    location: DimensionLocation,
    categories?: string[],
  ): void {
    for (const directionVector of DIRECTION_VECTORS) {
      const blockInDirection = location.dimension.getBlock(
        Vector3Utils.add(location, directionVector),
      );
      if (!blockInDirection) {
        continue;
      }

      if (categories) {
        for (const category of categories) {
          MachineNetwork.getWithBlock(category, blockInDirection)?.destroy();
        }
        continue;
      }

      for (const network of MachineNetwork.getAllWithBlock(blockInDirection)) {
        network.destroy();
      }
    }
  }

  /**
   * Update all {@link MachineNetwork}s that contain a machine that matches the arguments.
   */
  static updateWith(
    location: DimensionLocation,
    type: NetworkConnectionType,
  ): void {
    for (const network of MachineNetwork.getAllWith(location, type)) {
      network.destroy();
    }
  }

  /**
   * Update all {@link MachineNetwork}s that contain a block.
   */
  static updateWithBlock(block: Block): void {
    for (const network of MachineNetwork.getAllWithBlock(block)) {
      network.destroy();
    }
  }
}
