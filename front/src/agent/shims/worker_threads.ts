// Maps the node:worker_threads surface used by @earendil-works/pi-codemode onto Web Workers.
// Host side: `Worker`. Worker side: `parentPort` / `workerData` (set up by src/codemode-worker.ts).
type Listener = (value: any) => void;
const WebWorker = globalThis.Worker;
const scope = globalThis as any;
const inWorker = typeof scope.WorkerGlobalScope !== "undefined" && scope instanceof scope.WorkerGlobalScope;

export class Worker {
	private worker: globalThis.Worker;

	constructor(url: string | URL, options: { workerData?: unknown } = {}) {
		this.worker = new WebWorker(url, { type: "module" });
		this.worker.postMessage({ __workerData: options.workerData });
	}

	on(event: string, listener: Listener): this {
		if (event === "message") this.worker.addEventListener("message", (e) => listener(e.data));
		if (event === "error") this.worker.addEventListener("error", (e) => listener(e.error ?? new Error(e.message || "Worker failed to load")));
		// "exit": Web Workers do not report it; the host settles on "done", "crash" or its own deadline.
		return this;
	}

	postMessage(message: unknown): void {
		this.worker.postMessage(message);
	}

	async terminate(): Promise<number> {
		this.worker.terminate();
		return 0;
	}
}

export const workerData: unknown = inWorker ? scope.__workerData : undefined;

export const parentPort = inWorker
	? {
			postMessage: (message: unknown) => scope.postMessage(message),
			on(event: string, listener: Listener) {
				if (event !== "message") return;
				for (const message of scope.__pendingMessages.splice(0)) listener(message);
				scope.__onMessage = listener;
			},
		}
	: null;
