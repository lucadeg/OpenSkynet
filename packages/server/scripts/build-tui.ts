import solidPlugin from "@opentui/solid/bun-plugin";

const result = await Bun.build({
  entrypoints: ["src/tui/index.tsx"],
  outdir: "src/tui/.build",
  target: "bun",
  plugins: [solidPlugin],
  external: [
    "@opentui/core", "@opentui/solid", "solid-js",
    "child_process", "playwright", "playwright-core",
    "chromium-bidi", "openai",
    "../agent/stream-run.js", "../index.js",
    "./app.js", "./theme.js", "./config.js", "./session.js",
  ],
  sourcemap: "external",
});

if (!result.success) {
  console.error("Build failed:", result.logs);
  process.exit(1);
}
console.log("TUI built:", result.outputs.map(o => o.path).join(", "));
