import type { RPCServer } from "../server.js";
import type { RPCHandlerDeps } from "../deps.js";
import { setKey, getKey, listKeys } from "../../core/auth.js";

export function registerAuthHandlers(
  server: RPCServer,
  deps: RPCHandlerDeps,
): void {
  server.register("auth.set", async (params) => {
    const provider = params.provider as string;
    const key = params.key as string;
    await setKey(provider, key);
    return { set: true, provider };
  });

  server.register("auth.status", async (params) => {
    const provider = params.provider as string | undefined;
    if (provider) {
      const key = await getKey(provider);
      return { provider, has_key: key !== null };
    }
    const keys = await listKeys();
    const status: Record<string, { has_key: boolean }> = {};
    for (const [name] of Object.entries(keys)) {
      status[name] = { has_key: true };
    }
    return { providers: status };
  });
}
