// Stubs for Node modules that are imported but never reached in the browser.
import fsShim from "./fs";

const unavailable = (name: string) => (): never => {
	throw new Error(`${name} is not available in the browser`);
};

// child_process
export const spawn = unavailable("child_process.spawn");
export const spawnSync = unavailable("child_process.spawnSync");
export const exec = unavailable("child_process.exec");
export const execSync = unavailable("child_process.execSync");
export const execFile = unavailable("child_process.execFile");
export const execFileSync = unavailable("child_process.execFileSync");
// readline
export const createInterface = unavailable("readline.createInterface");
// os
export const homedir = () => "/";
export const tmpdir = () => "/tmp";
export const platform = () => "linux";
export const release = () => "";
export const arch = () => "wasm";
export const hostname = () => "browser";
export const cpus = () => [];
export const userInfo = () => ({ username: "browser", homedir: "/" });
export const EOL = "\n";
// url
export const fileURLToPath = (u: string | URL) => new URL(u).pathname;
export const pathToFileURL = (p: string) => new URL(`file://${p}`);
// module
export const createRequire = () =>
	Object.assign(
		(name: string) => {
			if (name === "fs" || name === "node:fs") return fsShim;
			throw new Error(`require("${name}") is not available in the browser`);
		},
		{ resolve: unavailable("require.resolve") },
	);
// util
export const promisify = (fn: unknown) => fn;
export const inspect = (v: unknown) => String(v);
export const stripVTControlCharacters = (s: string) => s;
// crypto
export const randomUUID = () => crypto.randomUUID();
export const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));
export const createHash = unavailable("crypto.createHash");

export default { spawn, spawnSync, exec, execSync, createInterface, homedir, tmpdir, platform, EOL, fileURLToPath, pathToFileURL, createRequire, promisify, inspect, randomUUID };

// os (continued)
export const constants = { signals: {} as Record<string, number> };
// perf_hooks
export const performance = globalThis.performance;
// stream
export const pipeline = unavailable("stream.pipeline");
export class Readable {
	static from = unavailable("stream.Readable.from");
	static fromWeb = unavailable("stream.Readable.fromWeb");
}
// zlib
export const crc32 = unavailable("zlib.crc32");
export const deflateRawSync = unavailable("zlib.deflateRawSync");
// events
export class EventEmitter {
	private listeners = new Map<string, Set<(...args: any[]) => void>>();
	on(event: string, listener: (...args: any[]) => void) {
		if (!this.listeners.has(event)) this.listeners.set(event, new Set());
		this.listeners.get(event)!.add(listener);
		return this;
	}
	off(event: string, listener: (...args: any[]) => void) {
		this.listeners.get(event)?.delete(listener);
		return this;
	}
	emit(event: string, ...args: any[]) {
		for (const listener of this.listeners.get(event) ?? []) listener(...args);
		return true;
	}
	addListener = this.on;
	removeListener = this.off;
}
