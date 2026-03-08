export function log(message: string, ...args: unknown[]): void {
  console.error(`[pixelforge] ${message}`, ...args);
}

export function logError(message: string, error?: unknown): void {
  if (error instanceof Error) {
    console.error(`[pixelforge] ERROR: ${message}`, error.message);
  } else {
    console.error(`[pixelforge] ERROR: ${message}`, error);
  }
}
