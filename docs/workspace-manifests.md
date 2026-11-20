# Workspace import manifests

A public Git repository can bootstrap a Chat AI workspace. Clone the repository
from **Create workspace → Clone a Git repository**. Chat AI asks the selected
local OpenCode agent to run the real `git clone`, then copies the repository
(including `.git`) into the chosen writable workspace storage.

If the repository root contains `chat-ai-manifest.json`, Chat AI validates it
and shows a confirmation summary before creating the workspace, agent, or chats.
Without a manifest, Chat AI still asks for confirmation and only copies the
repository.

## Storage support

The clone target can be:

- browser storage for the new workspace,
- the selected local agent's OpenCode project storage (the clone stays there and is mounted read-only in the workspace),
- a new local folder chosen with the File System Access picker,
- an existing writable source that supports folders (`local` or `mcp`).

Flat Arcana sources are not valid clone targets because they cannot represent a
repository directory tree.

## Security rules

- Only public HTTPS Git URLs are accepted.
- The OpenCode agent runs `git clone`; the manifest cannot provide commands,
  scripts, credentials, server URLs, or arbitrary executable content.
- Agent passwords and OpenCode server details never come from the manifest. The
  user selects an existing local agent connection, or chooses to configure
  another agent when that flow becomes available.
- Manifest chats may contain full conversation history and settings, but are
  treated as untrusted data. They are created only after confirmation.
- No manifest content is executed automatically. Creating a chat does not send
  a prompt. An agent's initial message is displayed and stored as an instruction
  entry, not sent as a prompt.

## Schema

`schemaVersion` must be `1`. Unknown top-level keys and invalid message roles are
rejected.

```json
{
  "schemaVersion": 1,
  "workspace": {
    "name": "Example project",
    "icon": "rocket",
    "color": "#009EE0"
  },
  "agent": {
    "name": "Example agent",
    "sessionTitle": "Example session",
    "model": "deepseek-v4.1-flash-1017",
    "bridgeWritable": true,
    "bridgeMcp": false,
    "bridgeInjectExternal": false,
    "initialMessage": {
      "title": "Welcome",
      "text": "This workspace was prepared from the example package. Start with the Getting started chat."
    }
  },
  "chats": [
    {
      "title": "Getting started",
      "folderName": "Guides",
      "settings": {
        "model": "deepseek-v4.1-flash-1017",
        "temperature": 0.5,
        "top_p": 1,
        "enable_tools": true,
        "memory_mode_override": "default"
      },
      "messages": [
        {
          "role": "system",
          "content": "You are a helpful assistant."
        },
        {
          "role": "user",
          "content": "Show me the project structure."
        },
        {
          "role": "assistant",
          "content": "The project contains..."
        }
      ]
    }
  ]
}
```

### Fields

| Field | Required | Meaning |
| --- | --- | --- |
| `schemaVersion` | yes | Must be `1`. |
| `workspace.name` | no | Suggested workspace name. The confirmation screen shows the final name. |
| `workspace.icon` | no | Existing topic icon id, default `rocket`. |
| `workspace.color` | no | Optional six-digit hex colour. |
| `agent.name` | no | Name for the new agent entry. |
| `agent.sessionTitle` | no | Title of the first OpenCode session. |
| `agent.model` | no | Model id to select when available. |
| `agent.bridgeWritable` | no | Whether the workspace bridge allows writes. Default `false`. |
| `agent.bridgeMcp` | no | Whether the workspace bridge exposes local MCP tools. Default `false`. |
| `agent.bridgeInjectExternal` | no | Whether the MCP servers OpenCode can reach itself are registered in OpenCode instead of only through the bridge. Default `false`. |
| `agent.initialMessage` | no | String or `{title?, text}` shown in the new agent session. It is also stored as a durable OpenCode instruction entry; it does not send a prompt. |
| `chats` | no | Up to 50 chats, each with up to 2000 messages. |
| `chats[].folderName` | no | Topic name; created if it does not exist. |
| `chats[].settings` | no | Normal per-chat settings. |
| `chats[].messages` | no | Conversation history with `system`, `user`, or `assistant` roles. |

The example repository lives in `remote-example/`.
