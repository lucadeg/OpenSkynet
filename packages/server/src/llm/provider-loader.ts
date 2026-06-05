import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";

export interface ProviderPreset {
  model: string;
  model_name?: string;
  display_name?: string;
  base_url?: string;
  api_key_env?: string;
  category: string;
  extra_models: Array<{ id: string; name: string }>;
  auto_detect: boolean;
}

const _PROVIDERS_DIR = join(import.meta.dir, "providers");

const _CATEGORY_LABELS: Record<string, string> = {
  cloud: "Cloud Providers",
  "cloud-cn": "Cloud Providers (China)",
  inference: "Inference Providers",
  local: "Local Providers",
};

export function loadProviders(): Record<string, ProviderPreset> {
  const result: Record<string, ProviderPreset> = {};

  if (!existsSync(_PROVIDERS_DIR)) return result;

  for (const category of readdirSync(_PROVIDERS_DIR, { withFileTypes: true })) {
    if (!category.isDirectory()) continue;
    const catDir = join(_PROVIDERS_DIR, category.name);
    for (const file of readdirSync(catDir)) {
      if (!file.endsWith(".yaml") && !file.endsWith(".yml")) continue;
      try {
        const raw = yaml.load(readFileSync(join(catDir, file), "utf-8")) as any;
        if (!raw?.name) continue;
        const models = raw.models ?? {};
        const list: Array<{ id: string; name: string }> = (models.list ?? []).map(
          (m: any) => ({ id: m.id, name: m.name ?? m.id }),
        );
        result[raw.name] = {
          model: models.default ?? "",
          model_name: list[0]?.name,
          display_name: raw.display_name ?? raw.name,
          base_url: raw.base_url,
          api_key_env: raw.api_key_env,
          category: category.name,
          extra_models: list,
          auto_detect: models.auto_detect === true,
        };
      } catch {
        // skip malformed yaml
      }
    }
  }

  return result;
}

export function loadProviderCategories(): Record<string, string> {
  return { ..._CATEGORY_LABELS };
}
