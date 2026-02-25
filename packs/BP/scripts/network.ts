import { Block, Dimension, DimensionLocation, system } from "@minecraft/server";
import { Vector3Utils } from "@minecraft/math";
import { DestroyableObject } from "./utils/destroyable";
import { logWarn } from "./utils/log";
import { getBlockUniqueId, getMachineStorage, setMachineStorage } from "./data";
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
  conduits: Map<string, Block>;
  machines: Map<string, Block>;
  networkLinks: Map<string, Block>;
}

interface DistributionData {
  total: number;
  queueItems: SendQueueItem[];
}

let totalNetworkCount = 0; // used to create a unique id
const networks = new Map<number, MachineNetwork>();

/**
 * A network of machines with a certain I/O type.
 */
export class MachineNetwork extends DestroyableObject {
  private allocateJobRunning = false;
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
      if (this.allocateJobRunning || !this.sendQueue.length) return;
      this.allocateJobRunning = true;
      system.runJob(this.allocate());
    }, 5);
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
  private *allocate(): Generator<void, void, void> {
    if (!this.isValid) return;

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

    // initialize consumers keys.      <priority>
    const consumers: Record<string, Map<number, Block[]>> = {};
    const networkStatListeners: [Block, InternalRegisteredMachine][] = [];

    for (const key of typesToDistribute) {
      consumers[key] = new Map();
    }

    yield;

    // find and filter connections into their consumer groups.
    for (const machine of this.connections.machines.values()) {
      if (!machine.isValid) {
        logWarn(
          "Found invalid machine in network in MachineNetwork#allocate. Skipping.",
        );
        continue;
      }
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

      yield;

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

        yield;
      }

      // Check if the machine is listening for network stat events.
      const machineDef = InternalRegisteredMachine.getInternal(machine.typeId);
      if (!machineDef) {
        logWarn(
          `Machine with ID '${machine.typeId}' not found in MachineNetwork#allocate.`,
        );
        continue;
      }

      if (machineDef.hasCallback("onNetworkAllocationCompleted")) {
        networkStatListeners.push([machine, machineDef]);
      }

      yield;
    }

    const networkStats: Record<string, NetworkStorageTypeData> = {};

    for (const type of typesToDistribute) {
      const distributionData = distribution[type];
      let budget = distributionData.total;

      const machinePriorities = Array.from(consumers[type].keys()).sort(
        (a, b) => b - a,
      );

      // Distribute to each consumer group in order of priority.
      for (const key of machinePriorities) {
        budget = yield* this.distributeToGroup(
          consumers[type].get(key)!,
          type,
          budget,
        );
        if (budget <= 0) break;
      }

      networkStats[type] = {
        before: distributionData.total,
        after: budget,
      };

      // Then return any left-over budget to the generators.
      yield* this.returnToGenerators(distributionData, type, budget);
    }

    for (const [block, machineDef] of networkStatListeners) {
      machineDef.callOnNetworkAllocationCompletedEvent(block, networkStats);
    }

    this.allocateJobRunning = false;
  }

  private *returnToGenerators(
    distributionData: DistributionData,
    type: string,
    leftOverBudget: number,
  ): Generator<void, void, void> {
    if (distributionData.queueItems.length === 0) return;

    const allocation = Math.floor(
      leftOverBudget / distributionData.queueItems.length,
    );
    let remainder = leftOverBudget % distributionData.queueItems.length;

    const typeCategory =
      InternalRegisteredStorageType.getInternal(type)?.category;

    for (const sendData of distributionData.queueItems) {
      const machine = sendData.block;
      if (!machine.isValid) {
        logWarn(
          "Found invalid machine in network in MachineNetwork#returnToGenerators. Skipping.",
        );
        continue;
      }

      const consumesCategory =
        typeCategory !== undefined &&
        machine.hasTag(
          `fluffyalien_energisticscore:consumer.category.${typeCategory}`,
        );

      const isConsumer =
        consumesCategory ||
        machine.hasTag("fluffyalien_energisticscore:consumer.any") ||
        machine.hasTag(`fluffyalien_energisticscore:consumer.type.${type}`);

      let actualBudgetAllocation = allocation;

      // Divide any remainder between the generators. (E.g. splitting 11 into 3 would output: 4, 4, 3)
      if (remainder > 0) {
        actualBudgetAllocation++;
        remainder--;
      }

      if (actualBudgetAllocation <= 0 && !isConsumer) {
        setMachineStorage(machine, type, 0);
        yield;
        continue;
      }

      if (isConsumer) {
        actualBudgetAllocation = Math.min(
          sendData.amount,
          actualBudgetAllocation,
        );

        setMachineStorage(
          machine,
          type,
          getMachineStorage(machine, type) +
            actualBudgetAllocation -
            sendData.amount,
        );

        yield;
        continue;
      }

      const machineDef = InternalRegisteredMachine.getInternal(machine.typeId);
      if (!machineDef) {
        logWarn(
          `Machine with ID '${machine.typeId}' not found in MachineNetwork#returnToGenerators.`,
        );
        yield;
        continue;
      }

      const newAmount = Math.min(
        actualBudgetAllocation,
        machineDef.maxStorage,
        sendData.amount,
      );

      setMachineStorage(machine, type, newAmount);

      yield;
    }
  }

  /**
   * @returns How much of the budget was left-over
   */
  private *distributeToGroup(
    machines: Block[],
    type: string,
    budget: number,
  ): Generator<void, number, void> {
    const budgetAllocation = Math.floor(budget / machines.length);

    for (const machine of machines) {
      const currentStored = getMachineStorage(machine, type);
      const machineDef = InternalRegisteredMachine.getInternal(machine.typeId);
      if (!machineDef) {
        logWarn(
          `Machine with ID '${machine.typeId}' not found in MachineNetwork#distributeToGroup.`,
        );
        continue;
      }

      const amountToAllocate = Math.min(
        budgetAllocation,
        machineDef.maxStorage - currentStored,
      );

      const v: RecieveHandlerResponse = machineDef.hasCallback("receive")
        ? yield* asyncAsGenerator(() =>
            machineDef.invokeRecieveHandler(machine, type, amountToAllocate),
          )
        : {};

      const actualAmount = v.amount ?? amountToAllocate;
      budget -= actualAmount;
      if (v.handleStorage ?? true) {
        setMachineStorage(machine, type, currentStored + actualAmount);
      }

      // give the scheduler a chance to breathe
      yield;
    }

    return budget;
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

    const locationUid = getBlockUniqueId(location);

    if (connectionType === NetworkConnectionType.Conduit) {
      return this.connections.conduits.has(locationUid);
    }
    if (connectionType === NetworkConnectionType.NetworkLink) {
      return this.connections.networkLinks.has(locationUid);
    }
    return this.connections.machines.has(locationUid);
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
      conduits: new Map(),
      machines: new Map(),
      networkLinks: new Map(),
    };

    const stack: Block[] = [];
    const visitedLocations = new Set<string>();

    function handleNetworkLink(block: Block): void {
      connections.networkLinks.set(getBlockUniqueId(block), block);

      const netLink = InternalNetworkLinkNode.tryGetAt(
        block.dimension,
        block.location,
      );

      if (!netLink) return;

      const selfIo = IoCapabilities.fromMachine(block, "network_link");

      const selfIsConduit = block.hasTag("fluffyalien_energisticscore:conduit");

      const linkedPositions = netLink.getConnections();

      for (const pos of linkedPositions) {
        const linkedBlock = block.dimension.getBlock(pos);

        if (
          linkedBlock === undefined ||
          visitedLocations.has(Vector3Utils.toString(linkedBlock.location))
        )
          continue;

        const linkedIsConduit = linkedBlock.hasTag(
          "fluffyalien_energisticscore:conduit",
        );

        if (!selfIo.acceptsType(ioType, linkedIsConduit)) continue;

        const linkedIO = IoCapabilities.fromMachine(
          linkedBlock,
          "network_link",
        );

        if (!linkedIO.acceptsType(ioType, selfIsConduit)) continue;

        handleBlock(linkedBlock);
      }
    }

    function handleBlock(block: Block): void {
      stack.push(block);
      visitedLocations.add(Vector3Utils.toString(block.location));

      if (block.hasTag("fluffyalien_energisticscore:conduit")) {
        connections.conduits.set(getBlockUniqueId(block), block);
        return;
      }

      if (block.hasTag("fluffyalien_energisticscore:network_link")) {
        handleNetworkLink(block);
      }

      if (block.hasTag("fluffyalien_energisticscore:machine")) {
        connections.machines.set(getBlockUniqueId(block), block);
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
    if (!connections.machines.size) {
      return;
    }

    return new MachineNetwork(ioType, block.dimension, connections);
  }

  static getFromId(id: number): MachineNetwork | undefined {
    return networks.get(id);
  }

  static getAll(): MapIterator<[number, MachineNetwork]> {
    return networks.entries();
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
