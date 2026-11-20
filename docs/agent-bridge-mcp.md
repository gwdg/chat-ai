# The agent bridge's MCP leg

Status: **shipped.** §1–§4 describe the current code, including the derived
agent address and the stdio sidecar that removed the tunneled-deployment trap.
§5 lists options that are still not implemented. Read it before changing the
bridge, the tunnel or the agent service's bridge routes.

The agent bridge lets an OpenCode agent read a workspace that lives in the
browser (§4.27 of `AGENTS.md`). It is two connections with different owners, and
only one of them can ride the SAIA model tunnel. That asymmetry is the source of
the one deployment trap this document exists to record.

## 1. Two legs

| Leg | Who connects to what | Address it uses | Rides the tunnel |
| --- | --- | --- | --- |
| **browser leg** | the page → the bridge host | a **path** on the page origin (`/agents/<id>/bridge/ws`, or `poll` + `reply`) | yes |
| **agent leg** | OpenCode or the sidecar → the bridge host | an **absolute** URL (`agentWsUrl`, `mcpUrl`) | no |

The browser leg is a path because the page knows its own origin and nothing
else. The agent leg is absolute because the agent process is not the browser: it
must be told an address it can dial.

OpenCode's MCP client offers exactly two transports — `local` (spawn a command,
speak stdio) and `remote` (POST JSON-RPC to a URL, optionally with headers). It
has no "send a chat completion" transport, so a tunneled deployment has nothing
to intercept for the agent leg: the request that carries a tool call is made by
OpenCode, not by the page.

A service-managed agent therefore gets a **stdio sidecar**: OpenCode spawns it,
it opens the agent leg as a WebSocket, and the browser opens the other leg (over
a socket, or `poll`/`reply` when only the model endpoint is reachable). The
request that would have been an unreachable HTTP hop is now made by the process
that already lives next to OpenCode.

## 2. Where the absolute URL comes from

`agent-service/src/saia_agent_service/bridge.py`:

```python
def _agent_base(app_settings, request, backend):
    configured = (app_settings.bridge_agent_url or "").strip()
    if configured:
        return configured.rstrip("/")
    port = app_settings.port
    if backend is not None:
        host = _loopback(app_settings.backend_host)
        if backend.kind == "process" or (
            backend.kind == "docker" and (backend.network or "") == "host"
        ):
            return f"http://{host}:{port}"
        if backend.kind == "docker":
            return f"http://host.docker.internal:{port}"
    return str(request.base_url).rstrip("/")
```

`mcpUrl` and `agentWsUrl` are `_agent_base(...) + /agents/<id>/bridge/...`. So:

1. `AGENT_SERVICE_BRIDGE_AGENT_URL` (`bridge_agent_url`) wins when set. It is an
   **origin only**; the routes append `/agents/<id>/bridge` themselves. Values
   with an `/agents` suffix produce `/agents/agents/...`.
2. A backend the service spawns shares its machine, so the address is derived
   from the service itself: loopback and the service's own
   `AGENT_SERVICE_PORT` for `process` and `network: host`, the docker gateway
   (`host.docker.internal`) for a container on its own network.
3. `kind: remote` keeps the request's address. OpenCode there is another host and
   the service cannot guess a reachable one; set the variable.

The browser leg is unaffected: `wsUrl`, `pollUrl` and `replyUrl` are returned as
paths, and `useAgentBridge` completes them with the page origin.

The derivation exists because of §3: behind the tunnel the request that arrives
is the service's own `POST /v1/chat/completions`, replayed into the ASGI app with
the *forwarder's* `scheme` and `server` (`tunnel.py#_origin()`/`_scope()`), which
is an address no agent process can dial.

## 3. The failure this removed

A tunneled local stack (`agentServiceMode: "tunnel"`, engine on `:10000`, agent
service on `:8090`) answered a session create with:

```json
"mcpUrl": "http://localhost:5000/agents/<id>/bridge/mcp/<sid>"
```

`localhost:5000` is a port of the forwarding hop, not of the host. OpenCode dials
it, gets `ECONNREFUSED`, marks the MCP server `failed`, and exposes no tools.

The symptom is easy to misread because the two legs fail independently:

- the **browser leg works** (it is a path), so the workspace popover shows the
  green "Agent bridge working" status row;
- the **agent leg does not**, so `workspace_*` never appears in the model's tool
  list.

Read the agent's own view of it, which is authoritative:

```bash
# through a dev proxy, or the service directly
curl -s http://127.0.0.1:8090/agents/<serviceAgentId>/opencode/api/mcp
```

A broken bridge shows `chatai-bridge-<8 chars>` entries with

```json
{"status": "failed", "error": "ECONNREFUSED: Unable to connect. Is the computer able to access the url?"}
```

Each page load creates a new session and therefore a new entry; the hook deletes
its own entry on a clean unmount, so entries left behind are leftovers from
crashes, reloads and hidden tabs. They are harmless but they make the list noisy.

To see what a tunneled deployment hands out without opening a browser:

```bash
curl -s -X POST http://localhost:10000/public/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"saia-agent","messages":[],"chat_ai_http":{
        "method":"POST","path":"/agents/<serviceAgentId>/bridge/sessions",
        "body":{"agentId":"<serviceAgentId>","workspaceId":"probe",
                "writable":false,"mcp":false}}}' |
  python3 -c 'import json,sys;b=json.load(sys.stdin)["chat_ai_http"]["body"];print(b["agentWsUrl"], b["mcpUrl"], b["sidecarCommand"])'
```

For a `process` backend this now prints a loopback `agentWsUrl`, a matching
`mcpUrl` and a `sidecarCommand`.

## 4. What is in place

### 4.1 The stdio sidecar

`agent-service/src/saia_agent_service/bridge_sidecar.py` is an MCP server over
stdin/stdout. It reads the browser's tool calls and forwards them over the agent
leg:

```
OpenCode ──MCP stdio──▶ bridge_sidecar.py ──WS agent leg──▶ service ──browser leg──▶ page
```

- **Registration.** The session response carries `sidecarCommand`. For a
  `process` backend the service defaults it to
  `[<sys.executable>, <abs path>/bridge_sidecar.py]`, so a service-managed agent
  needs no configuration. `useAgentBridge` registers that as the `local` MCP
  entry and only requires `agentWsUrl` + `agentToken`; the HTTP `mcpUrl` entry
  stays the fallback when no command is returned.
- **Contract.** The environment is identical to `back/bridge-sidecar.mjs`:
  `CHAT_AI_BRIDGE_URL`, `CHAT_AI_BRIDGE_TOKEN`, `CHAT_AI_BRIDGE_SCOPES`
  (`workspace`, plus `write`/`mcp`) and `CHAT_AI_BRIDGE_KEY` (the browser's
  random per-chat key, presented as the `x-bridge-key` header on the agent leg).
  The tool list comes from `bridge_tools.py#tool_definitions(writable, mcp)`, the
  same function the HTTP fallback uses, so the two transports cannot offer
  different tools.
- **stdout is the protocol.** Diagnostics go to stderr; a stray `print` corrupts
  the JSON-RPC stream. `tests/test_bridge_sidecar.py` runs the file as a
  subprocess and pins this, the tool list, the offline answer and that it starts
  from an absolute path with no `PYTHONPATH`.
- **Why a file, not `python -m`.** OpenCode runs a `process` backend with the
  agent workdir as its cwd, where a relative `PYTHONPATH` no longer resolves the
  package (the same trap that breaks the dummy backend in the end-to-end test).
  Running the file and having it insert its package parent on `sys.path` is
  independent of both cwd and `PYTHONPATH`.

An operator can override the command with
`AGENT_SERVICE_BRIDGE_SIDECAR_COMMAND` (JSON array). It is the only way to get a
sidecar for `kind: docker` (the container has its own filesystem) or
`kind: remote` (another host); without it those backends use `mcpUrl`.

### 4.2 When to set `AGENT_SERVICE_BRIDGE_AGENT_URL`

| Backend | Needs the variable? |
| --- | --- |
| `kind: process` (`local-opencode`) | no — loopback and `AGENT_SERVICE_PORT` are derived |
| `kind: docker` with `network: host` | no — same derivation |
| `kind: docker` on a bridge network | no for the URL; yes for `sidecarCommand` if you want stdio |
| `kind: remote` | **yes** — another host, no safe default |
| agent service behind a gateway that the agent cannot resolve | yes |

After changing it, restart the service and reconnect the bridge (toggle it off
and on, or reload the agent page) so a new session registers an entry with the
new base. Verify the entry reads `connected` in `/api/mcp`; a `connected` entry
exposes `workspace_list`, `workspace_stat` and `workspace_read`, plus the write
and MCP tools when those switches are on.

### 4.3 MCP resources

Tools let the model *ask* for a path. MCP resources are the other half of the
protocol: a client enumerates what exists and reads one entry without a tool
call, and an agent UI's MCP panel lists them.

Both hosts serve the workspace as resources, over the same two browser calls the
tools use (`workspace_list`, `workspace_read`), so no second transport exists and
data still leaves the browser only as the answer to an explicit read:

| Method | Answer |
| --- | --- |
| `initialize` | `capabilities.resources = {subscribe: false, listChanged: false}` (plus `tools`) |
| `resources/list` | every file under the workspace root, `chatai-workspace:///<path>` |
| `resources/templates/list` | `chatai-workspace:///{path}`, for a path the bounded walk did not reach |
| `resources/read` | `{contents: [{uri, mimeType, text \| blob}]}`; text is `text`, binary is base64 `blob` |
| `prompts/list` | `{prompts: []}` — an empty list, never an error |

- **Bounds.** One `resources/list` walks at most 40 directories to depth 3 and
  returns at most 200 files, because every step is a browser round trip. A folder
  the browser refuses (permission, unavailable source) is skipped rather than
  failing the listing.
- **The scheme is not `file://`.** A resource path is inside the user's workspace,
  not on the agent host, so a client must not open it locally. The uri has an
  empty authority (`chatai-workspace:///docs/a.md`) so the first segment is not
  parsed as a host; `path_for`/`resourcePath` also accept `//segment/path`.
- **A refused read is a protocol error** (`-32602`), not an empty resource: a file
  the bridge will not return (over 2 MB) has no other way to say so.
- **One source of truth per language.** `bridge_resources.py` serves both Python
  transports (sidecar and `mcpUrl`), `back/bridge-resources.mjs` serves both JS
  ones (`back/bridge-sidecar.mjs` and `back/bridge.mjs`). Change one, change the
  other; `test_bridge_resources.py` and `test-bridge-resources.mjs` pin the same
  cases.
- **A restart is required.** The capability is negotiated in `initialize`, so an
  agent page loaded against a pre-upgrade service still shows "no MCP resources"
  until the service is restarted (`make start`) and the bridge reconnected.

### 4.4 Servers OpenCode reaches itself

A server the OpenCode host can dial itself is better served natively, because its
tools then survive a closed tab. Two cases share that option:

- **No header.** "Inject external MCP tools" in the agent's workspace popover
  (`bridgeInjectExternal`, stored per agent like the write and MCP switches)
  registers the server as a `remote` entry. It needs neither bridge access nor an
  attached workspace: the servers are registered in the agent's own OpenCode, so
  the option stays usable while the bridge is off, and the relay narrows itself
  once a bridge starts. `useAgentMcpInjection` registers every configured server
  that has an HTTP URL and no stored headers through
  `PUT /api/experimental/mcp/<chatai-ext-…>` and `POST …/connect`, and polls
  `GET /api/mcp` for the result.
- **With a header.** A token may not leave the browser, so such a server is never
  a `remote` entry. It is wrapped as one stdio proxy per server (§4.5) when the
  same option is on and the bridge can spawn a sidecar; otherwise it stays on the
  relay, exactly as before.
- **One session owns an entry.** OpenCode's MCP registry belongs to the instance,
  so an entry added there is offered to every session of the agent. The entry is
  therefore named after the session (`chatai-ext-<server>-<session id>`, and
  `chatai-bridge-<session id>` for the bridge's own server), and
  `agents/agentMcpScope.js` writes that ownership into each session's permission
  ruleset (`PATCH /api/session/<id>`): deny `chatai-*`, then allow the entries
  whose session is that session or one of its ancestors, so a subagent keeps its
  parent's tools while a sibling session gets none. A denied tool disappears from
  the model's tool list; the last matching rule wins, which is why the allow comes
  after the deny. Nothing is registered without a session id, because an unnamed
  entry would be agent-wide, and entries are registered with `codemode: false` so
  each tool has its own action a rule can hide. `sweepStaleBridgeEntries` keeps
  exactly one bridge entry: a session switch replaces the name and removes the
  previous entry without restarting the bridge or its socket. The app remembers
  what it wrote per agent, so a later run removes only its own rules. A session
  created after the last run has no rules until the next one, and the moment
  between a switch and the re-registration still has the previous entry owned by
  its old session.
- **Kind is not a routing decision.** An entry with an address is injectable
  whether it is stored as `local` or as a gateway entry; a gateway entry that
  carries only a server id is answered by the gateway and never reaches OpenCode.
- **Success is decided by OpenCode.** `connected` means it is injected and the
  bridge relay drops it (`excludedMcpUrls`); `failed`, or still `pending` after
  the poll, removes the entry again and reports it as bridge-served.
- **Nothing is persisted.** `/experimental/mcp` is runtime-only, so the entries
  vanish with the OpenCode process and are reconciled on the next page load.
  A `localhost` URL means the OpenCode host, not the user's machine.

### 4.5 Authenticated servers: one stdio proxy each

A server with a stored header (`authorization`, an API key) must not be handed to
OpenCode as a `remote` entry, because that copies the secret onto the agent
host. The bridge session is already a path from that host back into the page, so
each such server gets its own `local` MCP entry that runs the sidecar in
**single-server proxy** mode:

```
OpenCode ──MCP stdio──▶ sidecar (CHAT_AI_BRIDGE_SERVER=<id>) ──agent leg──▶ host
                                                                  └──browser leg──▶ page ──header──▶ upstream MCP
```

- **Registration.** `agents/agentMcpInjection.js#wrappedMcpServers` selects every
  configured server with a non-empty `headers` object and a parseable URL.
  `useAgentBridge#registerWrappedEntries` registers one entry per server through
  the same experimental MCP routes, named
  `chatai-auth-<server>[-<counter>]-<session id>` so `agentMcpScope` scopes it to
  the session like the other entries. It runs when the browser leg is up (socket
  `onopen` or the first poll), because the proxy's first `tools/list` has to reach
  the page, and again on a session switch.
- **Environment.** The entry reuses the bridge's `CHAT_AI_BRIDGE_URL`,
  `CHAT_AI_BRIDGE_TOKEN`, `CHAT_AI_BRIDGE_SCOPES` and `CHAT_AI_BRIDGE_KEY`, plus
  `CHAT_AI_BRIDGE_SERVER=<configured server id>` and
  `CHAT_AI_BRIDGE_SERVER_NAME=<label>`. Both sidecars read the same contract:
  `back/bridge-sidecar.mjs` and `agent-service/…/bridge_sidecar.py`.
- **Proxy mode.** With `CHAT_AI_BRIDGE_SERVER` set, the sidecar advertises no
  workspace, write or relay tools. `tools/list` forwards `mcp_list_tools` and
  `tools/call` forwards `mcp_call` for that one server id, so the model sees the
  upstream's own tools. A `BRIDGE_OFFLINE` answer is retried for 20 × 250 ms,
  which covers the moment between OpenCode spawning the process and the page's
  socket opening.
- **The secret stays here.** The entry carries the server's configured **id**;
  the browser resolves the current URL and headers from
  `user_settings.mcp_servers` when a tool is called, so editing a token takes
  effect on the next call without re-registering. The proxy's `tools/call` answer
  is the upstream's raw MCP result (`callMcpServerToolResult`: `content`,
  `isError`), not the relay's flattened text, so images and structured blocks
  survive.
- **Only with a sidecar.** Wrapping needs the bridge session, so it requires
  bridge access, an attached workspace and a stdio `sidecarCommand`. With the
  HTTP `mcpUrl` fallback (a direct agent with no
  `opencodeBridgeSidecarCommand`) the server stays on the relay, as it always
  did. A proxy that cannot connect is removed again and reported
  (`wrappedMcpFailed`), which also leaves its server on the relay.
- **Several MCP clients per session.** The workspace sidecar and every proxy
  attach to one bridge session as separate agent sockets (`agentSockets` in
  `back/bridge.mjs`, `agent_sockets` in the service, cap 32). They share the one
  browser leg and the one `pending` map: request ids are unique, so an answer
  reaches the socket that asked, and a second attach never evicts the first.
- **Relay and wrapping are exclusive per server.** A wrapped server is answered
  even when the relay switch (`bridgeMcp`) is off — the proxy is OpenCode
  dialling the server itself — and the popover subtracts it from the "via
  bridge" count. `sweepStaleWrappedEntries` deletes `chatai-auth-*` entries of
  sessions that are no longer open; `bridgeInjectExternal` off removes them, and
  bridge access off removes them with the session they belonged to.

### 4.6 Verifying a direct agent end to end

`back/test-bridge-direct.mjs` (`npm run test:bridge-direct` in `back/`) is the
direct-agent counterpart of `back/test-bridge.mjs`. It runs the real
`back/bridge.mjs` host, the real `back/bridge-sidecar.mjs` as a stdio MCP server,
a browser leg that answers exactly like `useAgentBridge#handleToolCall` (an
in-memory workspace tree for `workspace_*`, a real HTTP MCP server for `mcp_*`),
and asserts the sidecar's tool list, reads, writes, resource listing and the
`BRIDGE_OFFLINE` answer when the browser is gone. Two cases cover §4.5: several
stdio clients attach to one session (the workspace sidecar plus a proxy, both
still working), and an authenticated server runs as a proxy whose entry carries
only the configured id while the browser applies the header — the fake MCP server
records what it received, so a leaked or missing token fails the test. No model
and no network are needed for that part.

The last test is opt-in and drives a live server:

```bash
DIRECT_OPENCODE_URL=http://127.0.0.1:9000 DIRECT_OPENCODE_PASSWORD=… \
  node --test back/test-bridge-direct.mjs
```

It registers, connects and finally removes the entry under
`chatai-bridge-<session id>`, prompts a tool-capable model, and asserts that the
browser leg saw `workspace_read` and `mcp_call` and that the file's contents
reached the model. It skips itself without a password.

- **The bridge host is `back`, not the engine and not OpenCode.** `bridgePath`
  (`VITE_BRIDGE_PATH`) names it for a direct agent; empty means `backendPath`. That
  matters for a local stack, where `backendPath` is the engine
  (`http://localhost:10000/public/v1`) and answers 404 for `/bridge/sessions`, and
  where `localhost:8081` is `back`. OpenCode itself is never the host: it answers
  405, because it has no bridge route at all. A `401` means `bridgeKey` (front) and
  `bridgeSharedSecret` (back) disagree, but both are optional: without a deployment
  secret the session is minted and the random per-chat key pairs the legs. Only an
  older `back` answers `503` (`agents.bridge.disabled_by_server`).
- **The sidecar path is the agent host's, not the app's.** A `local` MCP entry's
  `command` is resolved by the process that runs OpenCode, so a direct server in
  another container or on another machine cannot see `back/bridge-sidecar.mjs`
  from the checkout: node answers `Cannot find module`. Its `/api/fs` then lists
  that host's own project, which is how you tell the two filesystems apart. That
  is why a direct agent with no `opencodeBridgeSidecarCommand` uses the HTTP
  `mcpUrl` entry, and why the live test defaults to it
  (`DIRECT_OPENCODE_SIDECAR=<path on the agent host>` switches it to stdio).
- **The entry list is `GET /api/mcp`, not `/api/experimental/mcp`.** The latter
  answers 404 on OpenCode 2.3.0; `PUT`/`POST …/connect`/`DELETE` live under
  `experimental`, the list does not.

## 5. Not implemented

### 5.1 Route `/agents/*` at the gateway

The service's routes already assume this: the browser calls `/agents` on the app
origin, and the harness and OpenCode proxy are plain paths. Give the gateway a
path rule for `/agents` and both legs become ordinary gateway URLs; the tunnel is
then only needed for model traffic, and no absolute address has to be guessed.

- Needs: a gateway route, nothing in this repository.
- Cost: the same public exposure the service already has for every other
  `/agents` route. Owner scoping is unchanged.

### 5.2 Relay over the tunnel (the "reverse SAIA" variant)

Only one case needs this: a backend the service does **not** start (`kind:
remote`, e.g. `shared-opencode` at `http://opencode.internal:9000`), where the
agent box has no route back to the service and the gateway is the only reachable
address.

```
OpenCode ──MCP stdio──▶ relay ──saia-agent completion──▶ gateway ──▶ bridge host ──browser leg──▶ page
```

- **Transport.** The relay is a completions client: `POST
  …/public/v1/chat/completions` with `model: saia-agent` and the call in
  `chat_ai_http`. The outer hop forwards only `content-type`, so the bridge
  token travels as `?token=` — which `_authorized()` already accepts.
- **New route.** The agent leg is WebSocket-only today. This needs a
  request/response route on the service (e.g. `POST .../bridge/agent/<sid>`) that
  runs the existing `call_browser()` and returns the result, or an agent-side
  `poll`/`reply` pair mirroring the browser leg.
- **Identity is the blocker.** Every tunneled call is a `saia-agent` completion
  and must be attributable to a user, because the bridge's `owner_id` comes from
  the request identity. The browser has the OIDC session; a process on the agent
  box does not. Solving it means minting a service credential the engine trusts —
  the harness token (`POST /agents/{id}/harness/token`) is the existing precedent
  for a service-side outbound connection, but extending that to "may act for a
  user" is a policy decision, not a patch.
- **Cost.** One billed completion per tool call, each bounded by the engine's
  600 s read timeout, and the model API becomes an RPC channel.

A cheaper inversion for the same case: let the relay listen on a port the
**service** can dial (`0.0.0.0` + bearer, port published by the agent image) and
push each result from the service. `service → agent` already works — it is how
every `/agents/<id>/opencode/api/*` call gets through — so this needs no
credential and no tunnel, but the service must learn the port, and the port must
be reachable, which `kind: remote` does not guarantee.

## 6. Recommendation

1. Co-located backends: nothing to do (§2 derives the address, §4.1 registers the
   sidecar).
2. `kind: remote`: set `AGENT_SERVICE_BRIDGE_AGENT_URL`; use §5.1 if the
   deployment has a gateway.
3. §5.2 only for `kind: remote` behind a gateway with no route back, and only
   after the credential question is answered.

Independently of the choice: the UI does not report a dead agent leg. After
registering the MCP entry, `useAgentBridge` could read it back from `GET /api/mcp`
and surface a warning naming the entry and the variable; today only the browser
leg's status is visible.

## 7. Files

| File | Role |
| --- | --- |
| `front/src/hooks/useAgentBridge.ts` | session lifecycle, `sidecarCommandFor`/`wantsSidecar`, `bridgeBaseFor`, failure messages |
| `front/src/apis/opencodeAgents.js` | `addOpencodeMcpServer` / `connectOpencodeMcpServer` / `removeOpencodeMcpServer`, tunneled `rawRequest` |
| `front/src/apis/agentTunnel.js` | carries an `/agents` call in a `saia-agent` completion |
| `back/bridge-sidecar.mjs` | stdio MCP sidecar for **direct** agents (WebSocket + Bearer); `CHAT_AI_BRIDGE_SERVER` switches it to the single-server proxy mode of §4.5 |
| `front/src/hooks/useAgentMcpInjection.js` | reconciles `chatai-ext-*` (no header) per session and keeps the relay count |
| `front/src/agents/agentMcpInjection.js` | which servers are injectable / wrapped / relayed, and the `chatai-ext-*` / `chatai-auth-*` entry names |
| `front/src/agents/agentMcpScope.js` | session-scoped `permissions` rules for every `chatai-*` entry |
| `back/bridge.mjs` | `/bridge/*` for direct agents |
| `back/bridge-resources.mjs` | MCP resources for both JS hosts (sidecar + `mcpUrl`) |
| `back/test-bridge-direct.mjs` | end-to-end test for a direct agent (§4.6), with an opt-in live leg |
| `agent-service/src/saia_agent_service/bridge.py` | `/agents/<id>/bridge/*`, `_agent_base`, `_sidecar_command`, both legs |
| `agent-service/src/saia_agent_service/bridge_tools.py` | the one tool list both transports offer |
| `agent-service/src/saia_agent_service/bridge_resources.py` | MCP resources for both Python transports (§4.3) |
| `agent-service/src/saia_agent_service/bridge_sidecar.py` | the stdio MCP server a service-managed agent spawns, proxy mode included |
| `agent-service/tests/test_bridge_sidecar.py` | runs that file as a subprocess (tools, resources, offline, no `PYTHONPATH`) |
| `agent-service/src/saia_agent_service/tunnel.py` | replays a carried request, restores the outer `scheme`/`server` |
| `backends.example.yml` (`agent-service`) | backend kinds that decide which address is reachable |
