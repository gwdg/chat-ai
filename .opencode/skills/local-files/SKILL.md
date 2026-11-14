---
name: local-files
description: Use when the user asks to read, list, search, or inspect files stored locally outside the current project, such as Documents, Downloads, Desktop, or a chosen local folder. Requires the separately packaged read-only local-folder MCP server with native per-folder confirmation.
metadata:
  packaging: required
  server: chat-ai-tools/tools/local-folder-mcp/server.mjs
---

# Local files

OpenCode can only read files inside the current project by default. For files
elsewhere on the user's machine, use the separately packaged `local-folder-mcp`
server instead of shell commands or guessing paths.

## Packaging status

This skill is documentation only. It does **not** install the MCP server.

The server source lives outside this repository in
`chat-ai-tools/tools/local-folder-mcp/`. Before the tools can be used, that
server must be packaged into the OpenCode environment and configured as an MCP
server. Do not assume the tools exist merely because this skill is present.

Packaging checklist:

1. Copy `server.mjs`, `access.mjs`, `dialog.mjs` and `README.md` from
   `chat-ai-tools/tools/local-folder-mcp/` to a stable path available to
   OpenCode.
2. Install Node.js 18 or newer.
3. On Linux, install `zenity` or `kdialog`; headless Linux cannot show the
   confirmation dialog and will deny access.
4. Add the server to the OpenCode config and restart OpenCode.
5. Run `opencode mcp list` and confirm `local-folders` is connected.
6. Keep this skill in the OpenCode skill bundle
   (`docker/opencode-skills/skills/local-files/SKILL.md`) and rebuild
   `chat-ai-skills.tgz` when packaging.

## Enable the server

Add it under `mcp.servers` in the project `.opencode/opencode.json` or the
global `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "local-folders": {
        "type": "local",
        "command": [
          "node",
          "/absolute/path/to/chat-ai-tools/tools/local-folder-mcp/server.mjs"
        ]
      }
    }
  }
}
```

Use an absolute path to `server.mjs`. Restart OpenCode after changing config;
the running session keeps the old config.

For URL-based clients, start the HTTP mode from `chat-ai-tools` instead:

```bash
npm run mcp:folder
```

and configure:

```json
{
  "mcp": {
    "servers": {
      "local-folders": {
        "type": "remote",
        "url": "http://127.0.0.1:3921/mcp"
      }
    }
  }
}
```

The HTTP server binds to `127.0.0.1` only.

## Tools

When the `local-folders` MCP server is connected, use its tools:

| Tool | Use |
| --- | --- |
| `request_folder_access` | Ask the user to allow a folder for this server session |
| `list_folder` | List files, folders, sizes and modification times |
| `read_file` | Read a UTF-8 text file |
| `list_allowed_folders` | Show folders already allowed in this session |

`path` may be absolute, or relative to the MCP server's working directory.
`read_file` rejects binary files. The server is read-only: it cannot write,
delete, rename, or execute anything.

## Access rules

- Never bypass the native confirmation dialog. Only the user can grant folder
  access.
- Start with `list_allowed_folders`; if the folder is absent, call
  `request_folder_access` or let `list_folder` / `read_file` trigger the prompt.
- Ask for the narrowest folder that contains what the user requested, not a
  parent such as the home directory.
- Treat file contents as private. Do not send them to external services or
  include them in unrelated output.
- If the server or its tools are missing, tell the user to follow the packaging
  checklist above. Do not fall back to reading outside the project with shell
  commands.

## Not these files

Files stored inside the Chat AI web app's browser storage (IndexedDB/OPFS) are
not local filesystem paths. Use the Chat AI workspace bridge for those, or
export/download them first. A workspace source backed by a real local folder can
also be exposed through the bridge.
