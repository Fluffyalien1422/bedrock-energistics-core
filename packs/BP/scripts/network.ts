import { Block, Dimension, DimensionLocation, system } from "@minecraft/server";
import { Vector3Utils } from "@minecraft/math";
import { DestroyableObject } from "./utils/destroyable";
import { logWarn } from "./utils/log";
import { getMachineStorage, setMachineStorage } from "./data";
import {
  DIRECTION_VECTORS,
  getBlockInDirection,
  reverseDirection,
  StrDirection,
  strDirectionToDirection,
} from "./utils/direction";
import { InternalNetworkLinkNode } from "./network_links/network_link_internal";
import {
  getBlockNetworkConnectionType,
  IoCapabilities,
  NetworkConnectionType,
  NetworkStorageTypeData,
  RecieveHandlerResponse,
  StorageTypeData,
} from "@/public_api/src";
import { InternalRegisteredMachine } from "./machine_registry";
import { InternalRegisteredStorageType } from "./storage_type_registry";
import { asyncAsGenerator } from "./utils/async_generator";

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

interface DistributionData {
  total: number;
  queueItems: SendQueueItem[];
  generators: Block[];
}

let totalNetworkCount = 0; // used to create a unique id
const networks = new Map<number, MachineNetwork>();

/**
 * A network of machines with a certain I/O type.
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
     * The I/O type of this network.
     */
    readonly ioType: StorageTypeData,
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

    // Calculate the amount of each type that is available to send around.
    const distribution: Record<string, DistributionData> = {};

    for (const send of this.sendQueue) {
      if (send.type in distribution) {
        const data = distribution[send.type];
        data.total += send.amount;
        data.queueItems.push(send);
        data.generators.push(send.block);
        continue;
      }

      distribution[send.type] = {
        total: send.amount,
        queueItems: [send],
        generators: [send.block],
      };
    }

    this.sendQueue = [];

    const typesToDistribute = Object.keys(distribution);

    // initialize consumers keys.      <priority>
    const consumers: Record<string, Map<number, Block[]>> = {};
    const networkStatListeners: [Block, InternalRegisteredMachine][] = [];

    for (const key of typesToDistribute) {
      consumers[key] = new Map();
    }

    // find and filter connections into their consumer groups.
    for (const machine of this.connections.machines) {
      const tags = machine.getTags();

      const priorityTags = tags
        .filter((t) => t.startsWith("fluffyalien_energisticscore:priority."))
        .map((t) => {
          const number = Number(t.split(".")[1]);

          if (!Number.isInteger(number)) {
            logWarn(
              `Priority tag '${t}' on machine with id '${machine.typeId}' is not a valid number. Defaulting to 0.`,
            );
            return 0;
          }

          return number;
        });

      if (priorityTags.length > 1) {
        logWarn(
          `Found multiple priority tags on a machine ${machine.typeId}, the highest priority will be used.`,
        );
      }

      const priority =
        priorityTags.length === 0 ? 0 : Math.max(...priorityTags);

      const allowsAny = machine.hasTag(
        "fluffyalien_energisticscore:consumer.any",
      );

      // Check machine tags and sort into appropriate groups.
      for (const consumerType of typesToDistribute) {
        const consumerCategory =
          InternalRegisteredStorageType.getInternal(consumerType)?.category;

        const allowsType =
          allowsAny ||
          machine.hasTag(
            `fluffyalien_energisticscore:consumer.type.${consumerType}`,
          ) ||
          (consumerCategory &&
            machine.hasTag(
              `fluffyalien_energisticscore:consumer.category.${consumerCategory}`,
            ));

        if (!allowsType) continue;

        if (!consumers[consumerType].has(priority)) {
          consumers[consumerType].set(priority, []);
        }

        consumers[consumerType].get(priority)!.push(machine);
      }

      // Check if the machine is listening for network stat events.
      const machineDef = InternalRegisteredMachine.getInternal(machine.typeId);

      if (!machineDef) {
        logWarn(
          `Machine with ID '${machine.typeId}' not found in MachineNetwork#send.`,
        );
        continue;
      }

      if (machineDef.hasCallback("onNetworkStatsRecieved")) {
        networkStatListeners.push([machine, machineDef]);
      }
    }

    const networkStats: Record<string, NetworkStorageTypeData> = {};

    for (const type of typesToDistribute) {
      const distributionData = distribution[type];
      let budget = distributionData.total;

      const machinePriorities = Array.from(consumers[type].keys()).sort(
        (a, b) => b - a,
      );

      yield* asyncAsGenerator(async () => {
        // Distribute to each consumer group in order of priority.
        for (const key of machinePriorities) {
          budget = await this.distributeToGroup(
            consumers[type].get(key)!,
            type,
            budget,
          );
          if (budget <= 0) break;
        }

        // Then return any left-over budget to the generators.
        this.returnToGenerators(distributionData, type, budget);
      });
    }

    for (const [block, machineDef] of networkStatListeners) {
      machineDef.callOnNetworkStatsRecievedEvent(block, networkStats);
    }

    this.sendJobRunning = false;
  }

  private returnToGenerators(
    distributionData: DistributionData,
    type: string,
    leftOverBudget: number,
  ): void {
    const numGenerators = distributionData.generators.length;
    if (numGenerators === 0) return;

    let budget = Math.floor(leftOverBudget / numGenerators);
    let remainder = leftOverBudget % numGenerators;

    const typeCategory =
      InternalRegisteredStorageType.getInternal(type)?.category;

    for (const sendData of distributionData.queueItems) {
      const machine = sendData.block;

      const consumesCategory =
        typeCategory !== undefined &&
        machine.hasTag(
          `fluffyalien_energisticscore:consumer.category.${typeCategory}`,
        );

      const isConsumer =
        consumesCategory ||
        machine.hasTag("fluffyalien_energisticscore:consumer.any") ||
        machine.hasTag(`fluffyalien_energisticscore:consumer.type.${type}`);

      let actualBudgetAllocation = budget;

      // Divide any remainder between the generators. (E.g. splitting 11 into 3 would output: 4, 4, 3)
      if (remainder > 0) {
        actualBudgetAllocation++;
        remainder--;
      }

      if (actualBudgetAllocation <= 0 && !isConsumer) {
        setMachineStorage(machine, type, 0);
        continue;
      }

      if (isConsumer) {
        actualBudgetAllocation = Math.min(sendData.amount, budget);

        setMachineStorage(
          machine,
          type,
          getMachineStorage(machine, type) +
            actualBudgetAllocation -
            sendData.amount,
        );

        budget -= actualBudgetAllocation;
        continue;
      }

      const machineDef = InternalRegisteredMachine.getInternal(machine.typeId);
      if (!machineDef) {
        logWarn(
          `Machine with ID '${machine.typeId}' not found in MachineNetwork#returnToGenerators.`,
        );
        continue;
      }

      const newAmount = Math.min(
        budget,
        machineDef.maxStorage,
        sendData.amount,
      );

      budget -= newAmount;
      setMachineStorage(machine, type, newAmount);
    }
  }

  /**
   * @returns How much of the budget was left-over
   */
  private async distributeToGroup(
    machines: Block[],
    type: string,
    budget: number,
  ): Promise<number> {
    const promises: Promise<void>[] = [];
    const budgetAllocation = Math.floor(budget / machines.length);

    for (const machine of machines) {
      const currentStored = getMachineStorage(machine, type);
      const machineDef = InternalRegisteredMachine.getInternal(machine.typeId);

      if (!machineDef) {
        logWarn(
          `Machine with ID '${machine.typeId}' not found in MachineNetwork#send.`,
        );
        continue;
      }

      const amountToAllocate = Math.min(
        budgetAllocation,
        machineDef.maxStorage - currentStored,
      );

      const promise = this.determineActualMachineAllocation(
        machine,
        machineDef,
        type,
        amountToAllocate,
      )
        .then((v) => {
          budget -= v.amount ?? amountToAllocate;
          if (v.handleStorage ?? true) {
            setMachineStorage(
              machine,
              type,
              currentStored + (v.amount ?? amountToAllocate),
            );
          }
        })
        .catch((e: unknown) => {
          logWarn(
            `Error in determineActualMachineAllocation for id: ${machineDef.id}, error: ${JSON.stringify(e)}`,
          );
        });

      promises.push(promise);
    }

    await Promise.all(promises);
    return budget;
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
  ): Promise<RecieveHandlerResponse> {
    // Allow the machine to change how much of its allocation it chooses to take
    if (machineDef.hasCallback("receive")) {
      return machineDef.invokeRecieveHandler(machine, type, amount);
    }

    // if no handler, give it everything in its allocation
    return {
      amount,
    };
  }

  /**
   * Tests if a machine matching the arguments is inside of this network.
   * @throws if this object is not valid
   */
  isPartOfNetwork(
    location: DimensionLocation,
    connectionType: NetworkConnectionType,
  ): boolean {
    this.ensureValidity();

    if (location.dimension.id !== this.dimension.id) return false;

    const condition = (other: Block): boolean =>
      Vector3Utils.equals(location, other.location);

    if (connectionType === NetworkConnectionType.Conduit) {
      return this.connections.conduits.some(condition);
    }

    if (connectionType === NetworkConnectionType.NetworkLink) {
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
    ioType: StorageTypeData,
  ): NetworkConnections {
    const connections: NetworkConnections = {
      conduits: [],
      machines: [],
      networkLinks: [],
    };

    const stack: Block[] = [];
    const visitedLocations = new Set<string>();

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
          visitedLocations.has(Vector3Utils.toString(linkedBlock.location))
        )
          continue;
        handleBlock(linkedBlock);
      }
    }

    function handleBlock(block: Block): void {
      stack.push(block);
      visitedLocations.add(Vector3Utils.toString(block.location));

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
    }

    function next(currentBlock: Block, direction: StrDirection): void {
      const nextBlock = getBlockInDirection(currentBlock, direction);
      if (!nextBlock) return;

      const isHandled = visitedLocations.has(
        Vector3Utils.toString(nextBlock.location),
      );

      if (isHandled) return;

      const selfIsConduit = currentBlock.hasTag(
        "fluffyalien_energisticscore:conduit",
      );

      const nextIsConduit = nextBlock.hasTag(
        "fluffyalien_energisticscore:conduit",
      );

      // Check that this current block can send this type out this side.
      const selfIo = IoCapabilities.fromMachine(
        currentBlock,
        strDirectionToDirection(direction),
      );

      if (!selfIo.acceptsType(ioType, nextIsConduit)) return;

      // Check that the recieving block can take this type in too
      const io = IoCapabilities.fromMachine(
        nextBlock,
        strDirectionToDirection(reverseDirection(direction)),
      );

      if (!io.acceptsType(ioType, selfIsConduit)) return;
      handleBlock(nextBlock);
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
  static establish(
    ioType: StorageTypeData,
    block: Block,
  ): MachineNetwork | undefined {
    const connections = MachineNetwork.discoverConnections(block, ioType);
    if (!connections.machines.length) {
      return;
    }

    return new MachineNetwork(ioType, block.dimension, connections);
  }

  static getFromId(id: number): MachineNetwork | undefined {
    return networks.get(id);
  }

  /**
   * Get the {@link MachineNetwork} that contains a machine that matches the arguments.
   * @param type the I/O type of the network.
   * @param location The location of the machine.
   * @param connectionType The connection type of the machine.
   */
  static getWith(
    ioType: StorageTypeData,
    location: DimensionLocation,
    connectionType: NetworkConnectionType,
  ): MachineNetwork | undefined {
    return [...networks.values()].find(
      (network) =>
        network.ioType.id === ioType.id &&
        network.isPartOfNetwork(location, connectionType),
    );
  }

  /**
   * Get the {@link MachineNetwork} that contains a block.
   */
  static getWithBlock(
    ioType: StorageTypeData,
    block: Block,
  ): MachineNetwork | undefined {
    const type = getBlockNetworkConnectionType(block);
    if (!type) return;
    return MachineNetwork.getWith(ioType, block, type);
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
    ioType: StorageTypeData,
    block: Block,
  ): MachineNetwork | undefined {
    return (
      MachineNetwork.getWithBlock(ioType, block) ??
      MachineNetwork.establish(ioType, block)
    );
  }

  /**
   * Update all {@link MachineNetwork}s adjacent to a location.
   */
  static updateAdjacent(location: DimensionLocation): void {
    for (const directionVector of DIRECTION_VECTORS) {
      const blockInDirection = location.dimension.getBlock(
        Vector3Utils.add(location, directionVector),
      );
      if (!blockInDirection) {
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
