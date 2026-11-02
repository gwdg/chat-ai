// The `codemode` tool, as documented by pi-codemode: the model writes JavaScript that runs in
// QuickJS inside a Web Worker and reaches the outside only through `tools.<name>(args)`.
// It stands in for bash, and for grep, which needs ripgrep.
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { CodemodeSandbox, type CodemodeJsonSchema, type CodemodeTool, renderDeclarations } from "@earendil-works/pi-codemode";
import wasmUrl from "quickjs-wasi/quickjs.wasm?url";
import { Type } from "typebox";
import workerUrl from "./codemode-worker.ts?worker&url";

let wasm: Promise<WebAssembly.Module> | undefined;

export function createCodemodeTool(tools: AgentTool<any>[]): AgentTool<any> {
  const sandboxTools: CodemodeTool[] = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.parameters as CodemodeJsonSchema,
    outputSchema: { type: "string" },
    execute: async (args, { signal }) => {
      const result = await tool.execute("nested", args as never, signal);
      return result.content.map((block) => (block.type === "text" ? block.text : "")).join("\n");
    },
  }));

  const parameters = Type.Object({ code: Type.String({ description: "JavaScript source to run" }) });
  return {
    name: "codemode",
    label: "codemode",
    description: `Run JavaScript in a sandbox. The code is the body of an async function. It can only reach the outside through the tools below, called as \`await tools.<name>(args)\`. Output with text() or console.log(), or return a value. There is no DOM, fetch, timers or modules. Use it to search many files, or to transform data in bulk.\n\n${renderDeclarations({ tools: sandboxTools })}`,
    parameters,
    execute: async (_toolCallId, { code }, signal) => {
      wasm ??= WebAssembly.compileStreaming(fetch(wasmUrl));
      const sandbox = new CodemodeSandbox({ tools: sandboxTools, timeoutMs: 30_000, wasm, workerUrl });
      try {
        const result = await sandbox.execute(code, { signal });
        const content = [...result.output];
        if (result.ok && result.value !== undefined) content.push({ type: "text", text: JSON.stringify(result.value) });
        if (!result.ok) content.push({ type: "text", text: result.error.stack ?? result.error.message });
        if (!result.ok) throw new Error(content.map((block) => (block.type === "text" ? block.text : "")).join("\n"));
        return { content, details: undefined };
      } finally {
        await sandbox.close();
      }
    },
  };
}
