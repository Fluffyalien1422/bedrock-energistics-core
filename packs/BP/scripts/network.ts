import { Block, Dimension, DimensionLocation, system } from "@minecraft/server";
import { Vector3Utils } from "@minecraft/math";
import { DestroyableObject } from "./utils/destroyable";
import { logInfo, logWarn } from "./utils/log";
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
  MachineReceiveHandlerRes,
  StorageTypeData,
  NetworkStorageTypeData,
} from "@/public_api/src";
import { InternalRegisteredMachine } from "./machine_registry";
import { stringifyDimensionLocation } from "./utils/string";

interface SendQueueItem {
  block: Block;
  amount: number;
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

interface NetworkConsumer {
  block: Block;
  definition: InternalRegisteredMachine;
}

let totalNetworkCount = 0; // used to create a unique id
const networks = new Map<number, MachineNetwork>();

/**
 * A network of machines that share a single I/O type (e.g. one energy network).
 * @remarks
 * A network is a cached view of connected blocks, discovered by flood fill (see
 * {@link MachineNetwork.discoverConnections}). Each network runs its own
 * per-tick interval that, when there's queued output, distributes storage to
 * consumers by priority and returns the remainder to the senders
 * ({@link MachineNetwork.allocate}). Networks are disposable: any topology
 * change destroys the affected networks and a fresh one is discovered on demand
 * rather than being edited in place.
 */
export class MachineNetwork extends DestroyableObject {
  private allocateTickRunning = false;
  private allocateJob: AsyncGenerator<void, void, void> | undefined;
  private sendQueue: SendQueueItem[] = [];
  private readonly intervalId: number;

  latestNetworkStats: NetworkStorageTypeData = {
    before: 0,
    after: 0,
  };

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

    this.id = totalNetworkCount++;
    networks.set(this.id, this);

    // Drive allocation once per tick. Skip when there's nothing queued, or when
    // the previous tick's allocation job is still running (allocation is
    // chunked across ticks, see allocateTick), so jobs never overlap.
    this.intervalId = system.runInterval(() => {
      if (this.allocateTickRunning || !this.sendQueue.length) return;
      this.allocateTickRunning = true;
      void this.allocateTick();
    });
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
   * Advances the allocation job, running as many of its steps as fit in the
   * current tick. `allocate` is a generator that yields between machines; this
   * pumps it while the tick hasn't rolled over, then pauses until the next
   * interval fire. Large networks are therefore spread across multiple ticks
   * instead of blocking one. The job is kept in `allocateJob` so it resumes
   * where it left off.
   */
  private async allocateTick(): Promise<void> {
    const startTick = system.currentTick;
    this.allocateJob ??= this.allocate();

    while (system.currentTick === startTick) {
      const result = await this.allocateJob.next();
      if (result.done) {
        this.allocateJob = undefined;
        break;
      }
    }

    this.allocateTickRunning = false;
  }

  /**
   * processes the `sendQueue`. sends storage types to the consumers in the network starting
   * with the ones with the least stored.
   * automatically sets each generator's storage to the amount it sent that was not received.
   * returns automatically if the object is not valid.
   */
  private async *allocate(): AsyncGenerator<void, void, void> {
    if (!this.isValid) return;

    // Calculate the amount that is available to send around.
    const distribution: DistributionData = {
      total: 0,
      queueItems: [],
    };
    for (const send of this.sendQueue) {
      distribution.total += send.amount;
      distribution.queueItems.push(send);
    }

    this.sendQueue = [];

    // initialize consumers keys.
    // key: priority
    const consumers = new Map<number, NetworkConsumer[]>();
    const networkStatListeners: [Block, InternalRegisteredMachine][] = [];

    // find and filter connections into groups.
    for (const [machineUid, machine] of this.connections.machines) {
      if (!machine.isValid) continue;
      if (machine.typeId === "minecraft:air") {
        // Don't log a warning because this is a common occurence.
        // We still log it as info for debugging purposes though.
        logInfo(
          `The block with UID '${machineUid}' is air, but a registered machine was expected during allocation (allocate). Skipping. This may occur if a machine is destroyed while allocation is still in progress.`,
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

      const allowsAny = tags.includes(
        "fluffyalien_energisticscore:consumer.any",
      );

      // Is it a consumer?
      const consumesType =
        allowsAny ||
        tags.includes(
          `fluffyalien_energisticscore:consumer.type.${this.ioType.id}`,
        ) ||
        tags.includes(
          `fluffyalien_energisticscore:consumer.category.${this.ioType.category}`,
        );

      if (!consumesType) continue;

      // Look up the machine definition once and carry it through to
      // distribution so `distributeToGroup` doesn't have to look it up again.
      const machineDef = InternalRegisteredMachine.getInternal(machine.typeId);
      if (!machineDef) {
        logWarn(
          `Machine with ID '${machine.typeId}' not found during allocation (allocate).`,
        );
        continue;
      }

      if (!consumers.has(priority)) {
        consumers.set(priority, []);
      }
      consumers.get(priority)!.push({ block: machine, definition: machineDef });

      // Check if the machine is listening for network stat events.
      if (machineDef.hasCallback("onNetworkAllocationCompleted")) {
        networkStatListeners.push([machine, machineDef]);
      }

      yield;
    }

    // Now begin allocation.
    let budget = distribution.total;
    const machinePriorities = Array.from(consumers.keys()).sort(
      (a, b) => b - a,
    );

    // Distribute to each consumer group in order of priority.
    for (const key of machinePriorities) {
      budget = yield* this.distributeToGroup(consumers.get(key)!, budget);
      if (budget <= 0) break;
    }

    // Save network stat data.
    this.latestNetworkStats = {
      before: distribution.total,
      after: budget,
    };

    // Then return any left-over budget to the generators.
    yield* this.returnToGenerators(distribution, budget);

    // Call network stat events.
    for (const [block, machineDef] of networkStatListeners) {
      machineDef.callOnNetworkAllocationCompletedEvent(
        block,
        this,
        this.latestNetworkStats,
      );
    }
  }

  /**
   * Settles storage back onto the machines that queued sends, once distribution
   * to consumers is done. `leftOverBudget` (whatever consumers didn't take) is
   * split as evenly as possible across the queued senders - so a generator gets
   * back exactly the portion of its offering that went unused, and a queued
   * consumer's storage is reconciled against what it ended up with.
   */
  private *returnToGenerators(
    distributionData: DistributionData,
    leftOverBudget: number,
  ): Generator<void, void, void> {
    if (distributionData.queueItems.length === 0) return;

    const allocation = Math.floor(
      leftOverBudget / distributionData.queueItems.length,
    );
    let remainder = leftOverBudget % distributionData.queueItems.length;

    const type = this.ioType.id;
    const typeCategory = this.ioType.category;

    for (const sendData of distributionData.queueItems) {
      const machine = sendData.block;
      if (!machine.isValid) continue;
      if (machine.typeId === "minecraft:air") {
        // Don't log a warning because this is a common occurence.
        // We still log it as info for debugging purposes though.
        logInfo(
          `The block at ${stringifyDimensionLocation(machine)} is air, but a registered machine was expected during allocation (returnToGenerators). Skipping. This may occur if a machine is destroyed while allocation is still in progress.`,
        );
        continue;
      }

      const consumesCategory = machine.hasTag(
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
          `Machine with ID '${machine.typeId}' not found during allocation (returnToGenerators).`,
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
  private async *distributeToGroup(
    consumers: NetworkConsumer[],
    budget: number,
  ): AsyncGenerator<void, number, void> {
    const type = this.ioType.id;

    for (let i = 0; i < consumers.length; i++) {
      const { block: machine, definition: machineDef } = consumers[i];

      // Spread the remaining budget across the machines that haven't been
      // processed yet, recomputing each iteration. This ensures any budget a
      // machine doesn't take (because the 'receive' handler reduced/refused it,
      // or the machine is full) rolls forward to the remaining machines instead
      // of being lost. Rounding up keeps the budget distributing even when it
      // doesn't divide evenly. (E.g. splitting 11 into 3 would output: 4, 4, 3)
      const machinesLeft = consumers.length - i;
      const allocation = Math.ceil(budget / machinesLeft);

      const amountToAllocate = Math.max(
        Math.min(
          allocation,
          machineDef.maxStorage - getMachineStorage(machine, type),
        ),
        0,
      );

      const v: MachineReceiveHandlerRes = machineDef.hasCallback("receive")
        ? await machineDef.invokeRecieveHandler(machine, type, amountToAllocate)
        : {};

      const actualAmount = Math.max(v.amount ?? amountToAllocate, 0);
      budget -= actualAmount;
      if (v.handleStorage ?? true) {
        // Re-read the stored amount because the receive handler is an IPC
        // call that can span ticks, and the machine's storage may be changed
        // elsewhere in that window.
        setMachineStorage(
          machine,
          type,
          getMachineStorage(machine, type) + actualAmount,
        );
      }

      // give the scheduler a chance to breathe
      yield;
    }

    return budget;
  }

  /**
   * Core network membership test using a pre-computed block UID. The static
   * lookups that scan every network for a single location use this directly so
   * the UID and dimension ID are computed once, not once per network.
   */
  private hasConnection(
    dimensionId: string,
    locationUid: string,
    connectionType: NetworkConnectionType,
  ): boolean {
    if (dimensionId !== this.dimension.id) return false;

    if (connectionType === NetworkConnectionType.Conduit) {
      return this.connections.conduits.has(locationUid);
    }
    if (connectionType === NetworkConnectionType.NetworkLink) {
      return this.connections.networkLinks.has(locationUid);
    }
    return this.connections.machines.has(locationUid);
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

    return this.hasConnection(
      location.dimension.id,
      getBlockUniqueId(location),
      connectionType,
    );
  }

  /**
   * Tests if a block is inside of this network
   * @throws if this object is not valid
   */
  isBlockPartOfNetwork(block: Block): boolean {
    const type = getBlockNetworkConnectionType(block);
    if (type === undefined) return false;
    return this.isPartOfNetwork(block, type);
  }

  /**
   * Queues an amount to be distributed across the network on the next
   * allocation tick. Batching sends this way lets a whole tick's worth of
   * generation be allocated together, in one pass, by priority.
   */
  queueSend(block: Block, amount: number): void {
    if (amount <= 0) return;
    this.sendQueue.push({ block, amount: Math.floor(amount) });
  }

  /**
   * Flood-fills outward from `origin` to find every block reachable through
   * valid I/O connections for `ioType`, grouping them into conduits, machines,
   * and network links. This is how a network's membership is (re)built.
   * @remarks
   * Two blocks connect only if both sides accept the type across the shared
   * face (or link); conduits terminate a branch's data collection, machines are
   * recorded as endpoints, and network links jump to their linked positions.
   */
  private static discoverConnections(
    origin: Block,
    ioType: StorageTypeData,
  ): NetworkConnections {
    const connections: NetworkConnections = {
      conduits: new Map(),
      machines: new Map(),
      networkLinks: new Map(),
    };

    // Iterative flood fill: `stack` holds blocks left to expand, and
    // `visitedLocations` guards against revisiting a block reached via multiple
    // paths (and against cycles, which conduit loops and network links create).
    const stack: Block[] = [];
    const visitedLocations = new Set<string>();

    // Follows a network link's stored connections to their target blocks,
    // continuing the flood fill across the (possibly distant) jump. Both ends
    // must accept the type for the link to carry it.
    function handleNetworkLink(block: Block): void {
      connections.networkLinks.set(getBlockUniqueId(block), block);

      const netLink = InternalNetworkLinkNode.tryGetAt(
        block.dimension,
        block.location,
      );

      if (!netLink) return;

      const selfIo = IoCapabilities.fromBlock(block, "network_link");

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

        if (!selfIo.acceptsTypeData(ioType, linkedIsConduit)) continue;

        const linkedIO = IoCapabilities.fromBlock(linkedBlock, "network_link");

        if (!linkedIO.acceptsTypeData(ioType, selfIsConduit)) continue;

        handleBlock(linkedBlock);
      }
    }

    // Records a reachable block into the right group and marks it visited. A
    // block can be both a machine and a network link, but a conduit is only
    // ever a conduit, so that case returns early.
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

    // Probes the neighbour of `currentBlock` in one direction and, if the two
    // sides accept the type across that face, hands it to handleBlock to
    // continue the fill.
    function next(
      currentBlock: Block,
      direction: StrDirection,
      selfIsConduit: boolean,
      sharedSelfIo: IoCapabilities | undefined,
    ): void {
      const nextBlock = getBlockInDirection(currentBlock, direction);
      if (!nextBlock) return;

      const isHandled = visitedLocations.has(
        Vector3Utils.toString(nextBlock.location),
      );

      if (isHandled) return;

      const nextIsConduit = nextBlock.hasTag(
        "fluffyalien_energisticscore:conduit",
      );

      // Check that this current block can send this type out this side.
      // `sharedSelfIo` is passed in when the current block doesn't use
      // explicit-side IO (its capabilities are identical on every side);
      // otherwise the side-specific capabilities are computed here.
      const selfIo =
        sharedSelfIo ??
        IoCapabilities.fromBlock(
          currentBlock,
          strDirectionToDirection(direction),
        );

      if (!selfIo.acceptsTypeData(ioType, nextIsConduit)) return;

      // Check that the recieving block can take this type in too
      const io = IoCapabilities.fromBlock(
        nextBlock,
        strDirectionToDirection(reverseDirection(direction)),
      );

      if (!io.acceptsTypeData(ioType, selfIsConduit)) return;
      handleBlock(nextBlock);
    }

    handleBlock(origin);

    while (stack.length) {
      const block = stack.pop()!;

      // Compute the values that depend only on `block` once here, instead of
      // recomputing them inside next() for each of the 6 directions. Reading
      // the tags and building the IO capabilities is the bulk of discovery's
      // cost, and conduits (the most common block) are probed from all sides.
      const blockTags = block.getTags();
      const selfIsConduit = blockTags.includes(
        "fluffyalien_energisticscore:conduit",
      );

      // For blocks that don't use explicit-side IO, IoCapabilities.fromBlock
      // ignores the side and returns identical capabilities for every
      // direction, so it can be built once and reused. Explicit-side machines
      // must still be evaluated per direction (sharedSelfIo stays undefined).
      const sharedSelfIo = blockTags.includes(
        "fluffyalien_energisticscore:explicit_sides",
      )
        ? undefined
        : IoCapabilities.fromBlock(block, strDirectionToDirection("north"));

      next(block, "north", selfIsConduit, sharedSelfIo);
      next(block, "east", selfIsConduit, sharedSelfIo);
      next(block, "south", selfIsConduit, sharedSelfIo);
      next(block, "west", selfIsConduit, sharedSelfIo);
      next(block, "up", selfIsConduit, sharedSelfIo);
      next(block, "down", selfIsConduit, sharedSelfIo);
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
    const dimensionId = location.dimension.id;
    const locationUid = getBlockUniqueId(location);

    for (const network of networks.values()) {
      if (
        network.ioType.id === ioType.id &&
        network.hasConnection(dimensionId, locationUid, connectionType)
      ) {
        return network;
      }
    }

    return undefined;
  }

  /**
   * Get the {@link MachineNetwork} that contains a block.
   */
  static getWithBlock(
    ioType: StorageTypeData,
    block: Block,
  ): MachineNetwork | undefined {
    const type = getBlockNetworkConnectionType(block);
    if (type === undefined) return;
    return MachineNetwork.getWith(ioType, block, type);
  }

  /**
   * Gets every network that contains a matching block. A single location can
   * belong to more than one network when it carries multiple I/O types (one
   * network per type).
   */
  static getAllWith(
    location: DimensionLocation,
    type: NetworkConnectionType,
  ): MachineNetwork[] {
    const dimensionId = location.dimension.id;
    const locationUid = getBlockUniqueId(location);

    const result: MachineNetwork[] = [];
    for (const network of networks.values()) {
      if (network.hasConnection(dimensionId, locationUid, type)) {
        result.push(network);
      }
    }

    return result;
  }

  /**
   * Get all {@link MachineNetwork}s that contain a block.
   */
  static getAllWithBlock(block: Block): MachineNetwork[] {
    const type = getBlockNetworkConnectionType(block);
    if (type === undefined) return [];
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
