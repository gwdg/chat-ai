// Node globals that pi's tool modules expect. Must be the first import of every entry.
import { Buffer } from "buffer";

const g = globalThis as any;
g.global ??= globalThis;
g.Buffer ??= Buffer;
g.process ??= {
	platform: "linux",
	env: {},
	argv: [],
	versions: {},
	cwd: () => "/",
	nextTick: (fn: (...a: unknown[]) => void, ...a: unknown[]) => queueMicrotask(() => fn(...a)),
	stdout: { isTTY: false, columns: 80, write: () => true, on: () => {} },
	stderr: { isTTY: false, columns: 80, write: () => true, on: () => {} },
	on: () => {},
	off: () => {},
	once: () => {},
	emitWarning: () => {},
};
