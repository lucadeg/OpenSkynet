import type { RPCServer } from "../server.js";
import type { RPCHandlerDeps } from "../deps.js";

export function registerRecordHandlers(
  server: RPCServer,
  deps: RPCHandlerDeps,
): void {
  server.register("record.start", async (params) => {
    const name = (params.name as string) ?? `recording_${Date.now()}`;
    deps.activeRecording = {
      id: `rec_${Date.now()}`,
      name,
      status: "recording",
    };
    return { started: true, id: deps.activeRecording.id, name };
  });

  server.register("record.stop", async () => {
    if (!deps.activeRecording) {
      return { stopped: false, error: "No active recording" };
    }
    const id = deps.activeRecording.id;
    deps.activeRecording = null;
    return { stopped: true, id };
  });

  server.register("record.active", async () => {
    return { active: deps.activeRecording };
  });
}
