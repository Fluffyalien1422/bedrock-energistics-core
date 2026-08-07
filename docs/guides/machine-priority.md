---
title: Machine Allocation Priority
---

# Machine Allocation Priority

> [!note]
> Remember to update the machine's networks if this tag changes, for example when a block permutation changes. The simplest way to trigger a network update manually is with the {@link MachineNetwork.updateWithBlock} function.

A machine's priority during network allocation can be changed using the `fluffyalien_energisticscore:priority.{value}` tag. The default priority is `0`.

**Examples:** `fluffyalien_energisticscore:priority.-1`, `fluffyalien_energisticscore:priority.0`, `fluffyalien_energisticscore:priority.1`

All machines in the same priority group will receive an equal amount of remaining budget at the time of allocation. Groups with higher priorities will receive allocations first.

For example, if the priority groups are `0` and `-1`, then the machines in group `0` will each receive an equal split of the budget and the machines in group `-1` will each receive an equal split of the remaining budget (if applicable) **after** group `0` have received their allocations.
