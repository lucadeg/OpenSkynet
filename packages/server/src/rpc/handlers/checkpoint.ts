import type { RPCServer } from "../server.js";
import type { RPCHandlerDeps } from "../deps.js";

export function registerCheckpointHandlers(
  server: RPCServer,
  deps: RPCHandlerDeps,
): void {
  server.register("checkpoint.create", async (params) => {
    const name = (params.name as string) ?? `checkpoint_${Date.now()}`;
    const targetDir = params.target_dir as string | undefined;
    const cp = deps.checkpointManager.maybeCheckpoint(name, targetDir);
    if (!cp) return { created: false, error: "Could not create checkpoint" };
    return { created: true, id: cp.id, name: cp.name };
  });

  server.register("checkpoint.revert", async (params) => {
    const id = params.id as string;
    const targetDir = params.target_dir as string | undefined;
    const reverted = deps.checkpointManager.revert(id, targetDir);
    return { reverted };
  });

  server.register("checkpoint.list", async () => {
    const checkpoints = deps.checkpointManager.listCheckpoints();
    return { checkpoints };
  });
}
