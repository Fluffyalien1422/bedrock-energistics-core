import { InternalError, PublicError, PublicErrorType } from "./error.js";

export interface Logger {
  logInfo: (message: string) => void;
  logWarn: (message: string) => void;
  raise: (message: string) => never;
  raisePublic: (type: PublicErrorType, message: string) => never;
}

export function createLogger(
  makeLogStr: (logLevel: string, message: string) => string,
): Logger {
  return {
    logInfo(message: string): void {
      console.info(makeLogStr("Info", message));
    },
    logWarn(message: string): void {
      console.warn(makeLogStr("Warn", message));
    },
    raise(message: string): never {
      throw new InternalError(makeLogStr("InternalError", message));
    },
    raisePublic(type: PublicErrorType, message: string): never {
      throw new PublicError(type, makeLogStr(`PublicError:${type}`, message));
    },
  };
}
