// nicer console.log utility
const consoleLog = console.log;
console.log = function (...args) {
  const newArgs = args.map((arg) => {
    // Print objects like Vector3 as their actual values instead of just [object]
    if (typeof arg === "object" && arg !== null) {
      return JSON.stringify(arg);
    }
    return arg;
  });
  consoleLog.apply(console, newArgs);
};

import "./network_links/network_link_entity";
import "./block_destroyed";
import "./custom_components";
import "./script_events";
import "./ui";
