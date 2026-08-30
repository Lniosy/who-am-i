import { homedir, platform } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

const APP = "who-am-i";

export function home(): string {
  return homedir();
}

export function configDir(): string {
  const dir =
    platform() === "darwin"
      ? join(homedir(), "Library", "Application Support", APP)
      : platform() === "win32"
        ? join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), APP)
        : join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), APP);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function dataDir(): string {
  if (platform() === "linux") {
    const dir = join(process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"), APP);
    mkdirSync(dir, { recursive: true });
    return dir;
  }
  return configDir();
}

export function identityPath(): string {
  return join(configDir(), "identity.yaml");
}

export function settingsPath(): string {
  return join(configDir(), "settings.yaml");
}

export function dbPath(): string {
  return join(dataDir(), "whoami.db");
}

export function reportsDir(): string {
  const dir = join(dataDir(), "reports");
  mkdirSync(dir, { recursive: true });
  return dir;
}
