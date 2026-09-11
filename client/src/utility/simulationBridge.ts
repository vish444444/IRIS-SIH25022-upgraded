// Bridge disabled: frontend must not POST to /api/receiver.
// This file remains as a harmless stub in case any code imports it.

export async function pushAllTrainsToReceiver(_: any): Promise<{ success: number; failed: number }> {
  // No-op: intentionally do not POST from frontend
  return { success: 0, failed: 0 };
}

export const simulationSync = {
  start: () => {
    console.warn("simulationSync.start called but bridge is disabled in frontend.");
  },
  stop: () => {},
  isActive: () => false,
};
