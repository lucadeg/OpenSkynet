import type { RPCServer } from "../server.js";
import type { RPCHandlerDeps } from "../deps.js";
import {
  listProvidersWithAuth,
  createProvider,
} from "../../llm/provider.js";

export function registerModelHandlers(
  server: RPCServer,
  deps: RPCHandlerDeps,
): void {
  server.register("model.switch", async (params) => {
    const provider = params.provider as string;
    const model = params.model as string | undefined;
    const baseUrl = params.base_url as string | undefined;
    const apiKey = params.api_key as string | undefined;
    try {
      const newProvider = createProvider(provider, model, baseUrl, apiKey);
      Object.assign(deps.llmProvider, newProvider);
      return { switched: true, provider, model: model ?? "default" };
    } catch (err) {
      return { switched: false, error: (err as Error).message };
    }
  });

  server.register("model.list_providers", async () => {
    const providers = await listProvidersWithAuth();
    return { providers };
  });

  server.register("model.list", async (params) => {
    const provider = params.provider as string | undefined;
    const providers = await listProvidersWithAuth();
    if (provider) {
      const p = providers.find((pr) => pr.name === provider);
      return { models: p ? [{ id: p.default_model, name: p.default_model, provider: p.name }] : [] };
    }
    const models = providers.map((p) => ({
      id: p.default_model,
      name: p.default_model,
      provider: p.name,
    }));
    return { models };
  });
}
