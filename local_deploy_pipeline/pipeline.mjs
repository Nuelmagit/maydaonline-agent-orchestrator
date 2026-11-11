#!/usr/bin/env node
// pipeline.mjs — orquesta map build / ship UI / ship backend de los 3 repos con un comando.
// Corre en mac, linux y windows (git-bash): detecta OS, rutas de los repos y el binario de Godot.
//
//   npm run pl                                   # interactivo (desde rpg_server/)
//   npm run pl -- --all -m "msg"                 # map + ui + backend, sin preguntas
//   npm run pl -- --map --map-steps "maps pack"  # sólo build del mapa, ciertos pasos
//   npm run pl -- --ui --backend -m "hotfix"
//   npm run pl_dev                               # = --dev: build.sh + export:data, nada sale de la máquina
//   npm run pl_vultr                             # = --vultr: usa rpg_server/deploy-vultr/ en vez de deploy/
//
// Env overrides: GODOT_BIN, MAP_PCK_DEST, MAP_DATA_DEST, GODOT_UI_DIR, BASH_BIN.
// Doc completa: rpg_server/.claude/rules/deployment.md §"Pipeline local".

import { spawnSync, execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";

const OS = platform(); // 'darwin' | 'win32' | 'linux'
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const REQUIRED_GODOT = "4.7";

// ─── repos (nombres nuevos primero, viejos de fallback) ──────────────────────
const firstDir = (...cands) => cands.map((c) => join(ROOT, c)).find((p) => existsSync(p));
const RPG = firstDir("rpg_server");
const UI = process.env.GODOT_UI_DIR || firstDir("godot-mmorpgui", "godot_ui/new-game-project");
const MAP = firstDir("mmorpg_map", "test_cf_sprites");

// ─── args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const opt = { map: false, ui: false, backend: false, dev: false, vultr: false, msg: "", mapSteps: "", yes: false };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--all") opt.map = opt.ui = opt.backend = true;
  else if (a === "--map") opt.map = true;
  else if (a === "--ui") opt.ui = true;
  else if (a === "--backend") opt.backend = true;
  else if (a === "--dev") opt.dev = true;
  else if (a === "--vultr") opt.vultr = true;
  else if (a === "-y" || a === "--yes") opt.yes = true;
  else if (a === "-m" || a === "--message") opt.msg = argv[++i] ?? "";
  else if (a === "--map-steps") opt.mapSteps = argv[++i] ?? "";
  else if (a === "-h" || a === "--help") { printHelp(); process.exit(0); }
  else { console.error(`✗ flag desconocido: ${a}`); printHelp(); process.exit(2); }
}
const nonInteractive = opt.dev || opt.map || opt.ui || opt.backend;

function printHelp() {
  console.log(`uso: node pipeline.mjs [--dev] [--vultr] [--all|--map|--ui|--backend] [-m "msg"] [--map-steps "atlas maps minimaps pack"]`);
}

// ─── tools ───────────────────────────────────────────────────────────────────
function findBash() {
  if (process.env.BASH_BIN) return process.env.BASH_BIN;
  if (OS !== "win32") return "bash";
  const c = ["C:\\Program Files\\Git\\bin\\bash.exe", "C:\\Program Files (x86)\\Git\\bin\\bash.exe"].find(existsSync);
  return c || "bash";
}

function godotVersion(bin) {
  try {
    return execFileSync(bin, ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch { return null; }
}

function godotCandidates() {
  const c = [];
  if (OS === "darwin") {
    // Preferí un .app de REQUIRED_GODOT explícito (ej. Godot_v4.7*.app); Godot.app genérico al final.
    for (const dir of ["/Applications", join(homedir(), "Applications")]) {
      if (!existsSync(dir)) continue;
      const apps = readdirSync(dir).filter((n) => /^godot.*\.app$/i.test(n));
      const want = (n) => Number(n.includes(REQUIRED_GODOT));
      apps.sort((a, b) => want(b) - want(a));
      for (const app of apps) c.push(join(dir, app, "Contents/MacOS/Godot"));
    }
  } else if (OS === "win32") {
    c.push("C:\\Users\\Manuel\\Desktop\\godot 4.3\\Godot_v4.3-stable_win64_console.exe");
  }
  for (const name of [`godot${REQUIRED_GODOT}`, "godot4", "godot"]) {
    const r = spawnSync(OS === "win32" ? "where" : "which", [name], { encoding: "utf8" });
    if (r.status === 0) c.push(r.stdout.split(/\r?\n/)[0].trim());
  }
  return c.filter((p) => p && existsSync(p));
}

function findGodot() {
  if (process.env.GODOT_BIN) {
    return { bin: process.env.GODOT_BIN, version: godotVersion(process.env.GODOT_BIN) };
  }
  let fallback = null;
  for (const bin of godotCandidates()) {
    const version = godotVersion(bin);
    if (!version) continue;
    if (version.startsWith(REQUIRED_GODOT + ".")) return { bin, version };
    fallback ??= { bin, version };
  }
  return fallback;
}

// En git-bash (windows) las rutas tipo C:\x se pasan mejor como /c/x.
const toBashPath = (p) => (OS === "win32" ? p.replace(/^([A-Za-z]):\\/, (_, d) => `/${d.toLowerCase()}/`).replace(/\\/g, "/") : p);

const BASH = findBash();

function run(label, cmd, args, { cwd, env } = {}) {
  console.log(`\n▶ ${label}\n  $ ${[cmd, ...args].join(" ")}  (en ${cwd})`);
  const r = spawnSync(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: "inherit",
    shell: cmd === "npm" && OS === "win32",
  });
  if (r.error) console.error(`  ✗ ${r.error.message}`);
  return r.status === 0;
}

// ─── pasos ───────────────────────────────────────────────────────────────────
let GODOT = null;
function requireGodot() {
  if (GODOT) return GODOT;
  GODOT = findGodot();
  if (!GODOT) {
    console.error(`✗ No encuentro Godot. Seteá GODOT_BIN (ej. /Applications/Godot_v${REQUIRED_GODOT}.app/Contents/MacOS/Godot).`);
    return null;
  }
  console.log(`  Godot: ${GODOT.bin}  (${GODOT.version ?? "versión desconocida"})`);
  if (GODOT.version && !GODOT.version.startsWith(REQUIRED_GODOT + ".")) {
    console.error(
      `✗ Los proyectos son Godot ${REQUIRED_GODOT} y este es ${GODOT.version}.\n` +
        `  Un Godot más nuevo re-importa/migra los proyectos y genera un .pck que el cliente ${REQUIRED_GODOT} no carga.\n` +
        `  Instalá ${REQUIRED_GODOT} (ej. /Applications/Godot_v${REQUIRED_GODOT}.app) o forzá con GODOT_BIN=... ALLOW_GODOT_VERSION=1.`,
    );
    if (process.env.ALLOW_GODOT_VERSION !== "1") return null;
  }
  return GODOT;
}

function stepMap(steps) {
  if (!MAP) { console.error("✗ no encuentro mmorpg_map/ (ni test_cf_sprites/)"); return false; }
  const g = requireGodot();
  if (!g) return false;
  const env = {
    GODOT_BIN: toBashPath(g.bin),
    MAP_DATA_DEST: toBashPath(process.env.MAP_DATA_DEST || join(RPG, "src/data/map/32")),
    MAP_PCK_DEST: toBashPath(process.env.MAP_PCK_DEST || join(UI, "external_packages")),
  };
  const args = ["build.sh", ...(steps ? steps.split(/\s+/).filter(Boolean) : [])];
  return run(`map build (${steps || "atlas maps minimaps pack"})`, BASH, args, { cwd: MAP, env });
}

function stepExportData() {
  return run("export static data", "npm", ["run", "export:data"], { cwd: RPG });
}

const deployDir = () => (opt.vultr ? "deploy-vultr" : "deploy");

function stepUi() {
  const g = requireGodot();
  if (!g) return false;
  const env = { GODOT_BIN: toBashPath(g.bin), GODOT_UI_DIR: toBashPath(UI) };
  return run("ship UI (web)", BASH, [`${deployDir()}/ship-web.sh`], { cwd: RPG, env });
}

function stepBackend(msg) {
  if (!stepExportData()) return false;
  return run("ship backend", BASH, [`${deployDir()}/ship.sh`, ...(msg ? [msg] : [])], { cwd: RPG });
}

// ─── main ────────────────────────────────────────────────────────────────────
const results = [];
async function main() {
  if (!RPG) { console.error(`✗ no encuentro rpg_server/ en ${ROOT}`); process.exit(1); }
  console.log(`pipeline — os=${OS}  root=${ROOT}${opt.dev ? "  [dev]" : ""}${opt.vultr ? "  [vultr]" : ""}`);
  console.log(`  rpg_server: ${RPG}\n  ui:         ${UI ?? "—"}\n  map:        ${MAP ?? "—"}`);

  if (opt.dev) {
    // "update local": build del mapa + static data. Nada sale de la máquina.
    const okMap = stepMap(opt.mapSteps);
    results.push(["map", okMap]);
    if (!okMap) return;
    results.push(["export:data", stepExportData()]);
    return;
  }

  const rl = nonInteractive ? null : readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (q) => (await rl.question(q)).trim();
  const yes = async (q) => /^y(es)?$/i.test(await ask(`${q} [y/N] `));

  let doMap = opt.map, doUi = opt.ui, doBackend = opt.backend, mapSteps = opt.mapSteps, msg = opt.msg;
  if (rl) {
    doMap = await yes("Update map?");
    if (doMap) mapSteps = await ask("  build.sh steps (enter = atlas maps minimaps pack): ");
    doUi = await yes("Ship UI?");
    doBackend = await yes("Ship backend?");
    if (doBackend) msg = await ask("  commit message (vacío = redeploy in place): ");
  }

  const plan = [
    doMap && ["map", () => stepMap(mapSteps)],
    doUi && ["ui", stepUi],
    doBackend && ["backend", () => stepBackend(msg)],
  ].filter(Boolean);

  for (const [name, fn] of plan) {
    const ok = fn();
    results.push([name, ok]);
    if (!ok) {
      if (rl && (await yes(`✗ ${name} falló. ¿Seguir con el resto?`))) continue;
      break;
    }
  }
  for (const [name] of plan) if (!results.find(([n]) => n === name)) results.push([name, null]);
  rl?.close();
}

await main();
console.log("\n──── resumen ────");
for (const [name, ok] of results) console.log(`  ${ok === true ? "✓" : ok === false ? "✗" : "·"} ${name}`);
process.exit(results.some(([, ok]) => ok === false) ? 1 : 0);
