import { NetworkConnectionType } from "./network_utils.js";
import { SerializableDimensionLocation } from "./serialize_utils.js";

/**
 * @internal
 */
export interface NetworkInstanceMethodPayload {
  networkId: number;
}

/**
 * @internal
 */
export interface NetworkQueueSendPayload extends NetworkInstanceMethodPayload {
  loc: SerializableDimensionLocation;
  type: string;
  amount: number;
  minPriority: number | null;
}

/**
 * @internal
 */
export interface NetworkEstablishPayload {
  ioTypeId: string;
  location: SerializableDimensionLocation;
}

/**
 * @internal
 */
export interface NetworkGetWithPayload extends NetworkEstablishPayload {
  connectionType: NetworkConnectionType;
}

/**
 * @internal
 */
export interface NetworkGetAllWithPayload {
  loc: SerializableDimensionLocation;
  type: NetworkConnectionType;
}

/**
 * @internal
 */
export interface NetworkIsPartOfNetworkPayload
  extends NetworkInstanceMethodPayload {
  loc: SerializableDimensionLocation;
  type: NetworkConnectionType;
}

/**
 * @internal
 */
export interface GeneratePayload {
  loc: SerializableDimensionLocation;
  type: string;
  amount: number;
  minPriority: number | null;
}
