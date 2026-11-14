---
name: local-files
description: Use when the user asks to read, list, search, or inspect files stored locally outside the current project, such as Documents, Downloads, Desktop, or a chosen local folder. Uses the read-only local-folder MCP server with native per-folder confirmation.
---

# Local files

OpenCode can only read files inside the current project by default. For files
elsewhere on the user's machine, use the `local-folder-mcp` server instead of
shell commands or guessing paths.

## Tools

When the `local-files` MCP server is available, use its tools:

| Tool | Use |
| --- | --- |
| `request_folder_access` | Ask the user to allow a folder for this server session |
| `list_folder` | List files, folders, sizes and modification times |
| `read_file` | Read a UTF-8 text file |
| `list_allowed_folders` | Show folders already allowed in this session |

`path` may be absolute, or relative to the MCP server's working directory.
`read_file` rejects binary files. The server is read-only: it cannot write,
delete, rename, or execute anything.

## Enable the server

Add the local folder MCP server to the OpenCode config (project
`.opencode/opencode.json` or the global config) and restart OpenCode:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "local-files": {
      "type": "local",
      "command": [
        "node",
        "chat-ai-tools/tools/local-folder-mcp/server.mjs"
      ],
      "enabled": true
    }
  }
}
```

Use the absolute path to `server.mjs` if OpenCode's working directory is not
this repository. The server uses stdio in this form.

For URL-based clients, start the HTTP mode from `chat-ai-tools` instead:

```bash
npm run mcp:folder
```

and configure:

```json
{
  "mcp": {
    "local-files": {
      "type": "remote",
      "url": "http://127.0.0.1:3921/mcp"
    }
  }
}
```

The HTTP server binds to `127.0.0.1` only.

## Access rules

- Never bypass the native confirmation dialog. Only the user can grant folder
  access.
- Start with `list_allowed_folders`; if the folder is absent, call
  `request_folder_access` or let `list_folder` / `read_file` trigger the prompt.
- Ask for the narrowest folder that contains what the user requested, not a
  parent such as the home directory.
- Treat file contents as private. Do not send them to external services or
  include them in unrelated output.
- If the server or its tools are missing, tell the user to add the config above
  and restart OpenCode. Do not fall back to reading outside the project with
  shell commands.

## Not these files

Files stored inside the Chat AI web app's browser storage (IndexedDB/OPFS) are
not local filesystem paths. To use them, export/download them first, or use a
workspace source backed by a real local folder.
