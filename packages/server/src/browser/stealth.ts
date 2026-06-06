export function isStealthAvailable(): boolean {
  return true;
}

export function buildStealthLaunchArgs(opts: {
  headless: boolean;
  proxy?: string;
}): string[] {
  const args = [
    "--disable-blink-features=AutomationControlled",
    "--disable-features=IsolateOrigins,site-per-process",
    "--disable-infobars",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-extensions",
    "--disable-hang-monitor",
    "--disable-ipc-flooding-protection",
    "--disable-prompt-on-repost",
    "--disable-sync",
    "--metrics-recording-only",
    "--password-store=basic",
    "--use-mock-keychain",
    "--export-tagged-pdf",
  ];

  if (opts.headless) {
    args.push("--headless=new");
  }

  if (opts.proxy) {
    args.push(`--proxy-server=${opts.proxy}`);
  }

  return args;
}
