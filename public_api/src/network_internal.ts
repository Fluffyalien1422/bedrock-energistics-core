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
export interface MangledNetworkEstablishPayload {
  /**
   * category
   */
  a: string;
  /**
   * blockLocation
   */
  b: SerializableDimensionLocation;
}

/**
 * @internal
 */
export interface MangledNetworkGetWithPayload {
  /**
   * category
   */
  a: string;
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
  /**
   * sendReserveStorage
   */
  d: boolean;
  /**
   * consumeExisting
   */
  e: boolean;
}
