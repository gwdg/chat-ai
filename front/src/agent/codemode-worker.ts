// Web Worker entry for pi-codemode. pi's worker module reads `workerData` at import time,
// so wait for the host's first message before importing it (see shims/worker_threads.ts).
import "./shims/globals";

const scope = self as any;
scope.__pendingMessages = [];
scope.addEventListener("message", (event: MessageEvent) => {
  if (event.data && "__workerData" in event.data) {
    scope.__workerData = event.data.__workerData;
    import("@earendil-works/pi-codemode/worker");
  } else if (scope.__onMessage) {
    scope.__onMessage(event.data);
  } else {
    scope.__pendingMessages.push(event.data);
  }
});
