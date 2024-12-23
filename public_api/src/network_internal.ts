import { NetworkConnectionType } from "./network_utils.js";
import { SerializableDimensionLocation } from "./serialize_utils.js";

/**
 * @internal
 */
export interface MangledNetworkInstanceMethodPayload {
  /**
   * networkId
   */
  a: number;
}

/**
 * @internal
 */
export interface MangledNetworkQueueSendPayload
  extends MangledNetworkInstanceMethodPayload {
  /**
   * location
   */
  b: SerializableDimensionLocation;
  /**
   * type
   */
  c: string;
  /**
   * amount
   */
  d: number;
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
export interface MangledNetworkGetAllWithPayload {
  /**
   * location
   */
  a: SerializableDimensionLocation;
  /**
   * type
   */
  b: NetworkConnectionType;
}

/**
 * @internal
 */
export interface MangledNetworkIsPartOfNetworkPayload
  extends MangledNetworkInstanceMethodPayload {
  /**
   * location
   */
  b: SerializableDimensionLocation;
  /**
   * type
   */
  c: NetworkConnectionType;
}

/**
 * @internal
 */
export interface MangledGeneratePayload {
  /**
   * location
   */
  a: SerializableDimensionLocation;
  /**
   * type
   */
  b: string;
  /**
   * amount
   */
  c: number;
}
