# Design: Editable HTML Form Inputs from Tool Results

## 1. Goal

Let **any tool** declare structured options as part of its result. The frontend renders
those options as a regular HTML form the user can edit, and the submitted values are fed
back as the arguments of the next tool call. This lets e.g. an image tool say
"you can change the image size" and have the user set `width` / `height` in a form before
the tool runs.

Concretely: when a tool produces a JSON payload containing HTML form fields, the assistant
message renders an editable form; the user edits it, submits, and the entered values are fed
back as the arguments of a follow-up tool call the gateway executes (§3.6).

## 2. Current state (what exists today)

The feature is **not implemented**. There is no form/schema infrastructure. What exists:

- **Tools run server-side.** `front/src/apis/chatCompletions.jsx:62-66` sends
  `params.tools = [{type:<toolKey>}, ...]`; `back/service.mjs:275-316` maps those keys to
  gateway tool names and sets `runToolsOnServer: true`. Tool *progress* streams back as
  OpenAI `delta.tool_calls[].function.name === "<tool>.event"` chunks.
- **Tool events become text.** `front/src/utils/sendMessage.jsx:322-440` parses each
  `*.event` chunk and appends a human-readable string to `process_block`, which is folded
  into the assistant message's markdown text (the "thinking" block). No structured result is
  retained.
- **Content model is text/file only.** `front/src/db/dbTypes.ts:70-85`:
  `ContentItemRow.type: 'text' | 'file'`. `db/index.ts:361-393` drops any other type.
- **Only user/assistant messages are sent.** `sendMessage.jsx:246-253` filters
  `buildConversationForAPI` output to `role === "user" | "assistant"`. `tool`/`function`
  roles exist in `MessageRole` (`dbTypes.ts:3`) but are never produced or rendered.
- **No JSON-schema / form rendering code anywhere** in the repo.
- **Security:** per AGENTS.md §5, `rehype-raw` must never be enabled without a sanitizer;
  raw HTML from model output reaching the DOM is a live-injection risk (`<iframe>`,
  `<style>`). Any HTML rendering of tool output must be sanitized or kept non-HTML.

## 3. Proposed design

### 3.1 Wire format (tool → frontend)

A tool that wants user input returns, in its result, a structured block the frontend
recognises. Since tools currently stream only `*.event` text, we add a new event name that
carries a full form description, e.g.:

```
tool_calls[0].function.name = "<tool>.form"
tool_calls[0].function.arguments = {
  "tool_id": "image_generation",
  "title": "Image settings",
  "description": "You can change the image size.",
  "fields": [
    { "name": "width",  "label": "Width",  "type": "number", "value": 1024, "min": 256,  "max": 2048, "step": 64 },
    { "name": "height", "label": "Height", "type": "number", "value": 1024, "min": 256,  "max": 2048, "step": 64 },
    { "name": "quality","label": "Quality","type": "select", "value": "high",
      "options": [ {"value":"low","label":"Low"}, {"value":"high","label":"High"} ] }
  ]
}
```

`fields[].type` maps to native HTML input types (`text`, `number`, `range`, `checkbox`,
`select`, `textarea`, `radio`, `date`, `color`, …). Each field carries `name`, optional
`label`, optional `value`/`default`, and type-specific attributes (`min`, `max`, `step`,
`options`, `placeholder`, …). The set of supported types is deliberately limited to
**regular, declarative HTML form controls** — no arbitrary markup.

The same `fields` array is what the backend/gateway author produces; the frontend never
executes or renders arbitrary HTML from it, only known field types.

### 3.2 New content item type: `form`

To make the form part of the persisted conversation (survives reload, export/import), add a
new content item type `form`.

**`front/src/db/dbTypes.ts`:**
```ts
export type FormField = {
  name: string
  label?: string
  type: string            // html input type: text | number | range | checkbox | select | ...
  value?: any
  default?: any
  placeholder?: string
  min?: number; max?: number; step?: number
  options?: { value: string; label: string }[]
  required?: boolean
}

export type FormContent = {
  type: 'form'
  tool_id?: string
  title?: string
  description?: string
  fields: FormField[]
  submitted?: boolean     // true once the user has sent values
  values?: Record<string, any>  // captured input values after submit
}
```

Extend the unions:
- `ContentItemRow.type` → `'text' | 'file' | 'form'`
- `ContentItemInput.type` → `'text' | 'file' | 'form'` (`form` uses the same shape;
  `file`/`fileId` remain optional and unused for `form`).

No Dexie version bump is needed: `form` is a **stored, never-indexed** property
(AGENTS.md §4.3). `content_items` keeps `text`/`fileId` columns plus an unindexed `form`
object.

### 3.3 Capture during streaming (`sendMessage.jsx`)

In `getChatChunk` (`sendMessage.jsx:309+`), the existing code is a long if-chain of hardcoded
`*.event` names (`sendMessage.jsx:322-440`). Rather than bolt another branch onto it, **refactor
it into a small registry**: a map from event name → handler. Each handler returns either a text
fragment (existing behaviour, appended to `process_block`) or a form object (new). Then:

```
"<tool>.form" -> (arg) => ({ form: normalizeForm(arg) })   // NOT appended to process_block
```

When streaming finishes, if a form was collected, append it as an additional content item on the
assistant message:

```js
// after message_text is finalised, currentContent = [
//   { type: 'text', text: message_text },
//   ...(collectedForms.length ? collectedForms : []),
// ]
```

Collect forms into an **array** so a single turn can produce more than one form (§5.5).

### 3.4 Persistence (`db/index.ts`)

`updateConversation` normalises each content item (`db/index.ts:361-393`). Add a branch:

```js
else if (item.type === 'form') {
  // write { type:'form', form: {tool_id, title, description, fields, submitted, values} }
}
```

`hydrateConversation` (`db/index.ts:154-166`) reconstructs the nested shape; add the matching
`form` branch so it round-trips.

`processContentItems` (`sendMessage.jsx:16-126`) — the `form` content item must **not** be
forwarded to the model as a `text`/`file`; it is UI-only. Skip `form` items when building the
API conversation (they are represented by the tool call itself, §3.6).

### 3.5 Rendering (`MessageAssistant.jsx` + new component)

Create `front/src/components/Conversation/MessageAssistant/ToolForm.jsx` (or a sibling
`components/StructuredToolResponses/` folder — see §6 note). In `MessageAssistant.jsx`
(around line 285-305), iterate `message.content` and render `<ToolForm>` for every
`item.type === 'form'` (in addition to the existing text markdown + attachments).

`ToolForm` responsibilities:
- Render each `field` as a labelled native HTML control based on `field.type`.
- Initialise values from `field.value` / `field.default`, or from previously persisted
  `form.values`.
- Local controlled state; live value updates.
- On **Submit**, collect `{name: value}` for all fields, set `form.submitted = true` and
  `form.values`, persist, and trigger the follow-up tool call (§3.6).
- Provide a **Reset to defaults** and **Cancel/remove** action.

**Rendering is declarative, never raw HTML.** Only known `field.type`s are mapped to
React-controlled inputs. Unrecognised types render as a disabled text input or are skipped.
We do **not** use `dangerouslySetInnerHTML` or `rehype-raw` (AGENTS.md §5). The `title` /
`description` fields are rendered as plain text / React components, not as raw HTML.

### 3.6 Feed values back as the next tool call

**Primary path (client-authored tool call, MCP shape).** The gateway honours client-supplied
`tool_calls`, so on submit we emit a tool invocation the gateway will execute, in the standard
OpenAI function-calling / MCP shape:

```js
// user turn declaring the tool call the gateway should run
{ role: "user", content: "Please run the tool with my chosen settings.",
  tool_calls: [{ id: "call_<ts>", type: "function",
                 function: { name: form.tool_id, arguments: JSON.stringify(form.values) } }] },
// assistant turn acknowledging, so the result lands in a fresh message
{ role: "assistant", content: null }
```

The gateway runs the tool server-side (`runToolsOnServer: true`, `service.mjs:276-278`) with
`arguments` = the form's submitted values, and its result (files, text, further forms) streams
into the existing placeholder assistant message (`sendMessage.jsx:296-306`).

**Fallback (user-instruction injection, no `tool_calls`):** if a gateway ever stops honouring
client `tool_calls`, inject the values as an ordinary **user** message the model relays to the
tool:

```js
{ role: "user",
  content: `Please run the "${form.tool_id}" tool with these settings:\n` +
           JSON.stringify(form.values) }
```

**To wire the primary path**, extend `useSendMessage.jsx:22` and `sendMessage` to accept an
optional `formSubmission = { tool_id, values }`; `sendMessage` appends the two messages above to
`conversationForAPI.messages` **after** the role filter (`sendMessage.jsx:246-253`) and then
proceeds with the normal streaming loop. This adds `tool`/`function`-role traffic to the API
conversation but keeps them out of the persisted DB (the form itself is already persisted as a
content item, §3.4).

### 3.7 Redux vs DB for form values

Form **descriptions** are conversation data and belong in Dexie (content items, §3.4) so they
survive reload and round-trip through export/import.

Edited-but-not-yet-submitted values can live in the component's local state and, if we want
draft persistence, in a Redux slice. The stale `FORM_PERSISTENCE_DE.md` used a
`structuredToolResponses` Redux slice persisted to localStorage — that is optional here and
only for drafts. If added, it must follow AGENTS.md §4.1: add to the `whitelist` **and**
`getDefaultState()` in `Redux/store/store.jsx`, and decide whether it should sync across tabs
(the `redux-state-sync` whitelist currently only mirrors `SET_ADV`/`RESET_ALL`/`MIGRATE`/
`SET_COUNT`). Keep draft persistence out of v1 unless required.

## 4. File-by-file change list

| File | Change |
| --- | --- |
| `front/src/db/dbTypes.ts` | Add `FormField`/`FormContent`; extend `ContentItemRow`/`ContentItemInput` `type` unions. |
| `front/src/db/index.ts` | Handle `type:'form'` in `updateConversation` (write) and `hydrateConversation` (read). No version bump. |
| `front/src/utils/sendMessage.jsx` | Refactor `*.event` parsing into a registry; add `<tool>.form` handler; skip `form` items in `processContentItems`; append forms as content items; accept `formSubmission` and append the MCP-style `tool_calls` messages (§3.6). |
| `front/src/hooks/useSendMessage.jsx` | Thread `formSubmission` param through to `sendMessage`. |
| `front/src/components/Conversation/MessageAssistant/MessageAssistant.jsx` | Render `<ToolForm>` for each `form` content item. |
| `front/src/components/Conversation/MessageAssistant/ToolForm.jsx` (new) | Controlled native-input form + submit/reset; declarative field→input mapping only. |
| `front/src/apis/chatCompletions.jsx` | No change required (params unchanged). |
| `back/service.mjs` | **No change required** — the gateway honours client `tool_calls`; the existing pipeline already forwards them. |
| `front/src/i18n/en.js`, `de.js` | Add any UI strings (submit/reset labels, title) to **both**. |
| (optional) `front/src/Redux/reducers/*` + `store.jsx` | Draft value persistence, if desired (§3.7). |

## 5. Open questions / risks

1. **Gateway tool-call semantics.** The gateway honours client-supplied `tool_calls`, but the
   exact naming/behaviour contract for an *arbitrary* tool name (`form.tool_id`) should be
   confirmed — e.g. whether a tool that does not normally take an `image_modify`-style call
   accepts an `arguments` payload as posted. If some tools reject it, those tools fall back to
   the user-instruction path (§3.6).
2. **How does a tool actually emit `<tool>.form`?** The wire format (§3.1) is a new event
   name. Confirm the gateway/tool contract supports arbitrary `*.event` names and a rich
   `arguments` object (existing events already carry arbitrary JSON, so this is expected to
   work, but the exact event-name namespace should be agreed).
3. **Security.** Only render known, declarative field types; never render `title`/`description`
   as HTML; keep `rehype-raw` off (AGENTS.md §5).
4. **`processContentItems` forward behaviour.** Confirm `form` items are dropped when building
   the API conversation so they don't leak as text.
5. **Multi-form / multiple tool forms in one turn** — the accumulation in §3.3 should handle a
   list of forms, not a single variable.

## 5bis. Design alternatives considered

These were evaluated and either rejected or deferred; recording them so the choice is explicit.

- **User-instruction injection as the primary path (rejected).** Sending the values as a plain
  user message for the model to relay is more robust against gateways that ignore client
  `tool_calls`, but it is indirect (delivery depends on the model). Since the gateway honours
  client `tool_calls`, the direct MCP path is primary; the user-instruction path is kept as the
  documented fallback (§3.6).
- **Generic JSON-Schema-driven forms (deferred).** The tool could return a full JSON Schema and
  the frontend auto-render it. Far more powerful, but needs a form library / schema→UI engine —
  heavy for "regular HTML input fields". The simple declarative `fields[]` array (§3.1) covers the
  requirement with near-zero new dependencies. JSON Schema remains a natural future extension of
  the same `form` content item if richer forms are ever needed.
- **Store form descriptions on `MessageRow.meta` instead of a content item (rejected).** `meta`
  (`dbTypes.ts:49`) round-trips with no DB surgery and is far less code. But `form` is first-class
  *content*, not metadata: it should survive alongside the text/attachments it accompanies, render
  through the same content loop, and stay model-shaped. Content item is the better home; `meta` is
  the fallback if content-item changes prove costly.
- **Redux draft persistence (deferred).** Only useful for un-submitted drafts; add only if the UX
  needs it (§3.7).

## 6. Note on stale design docs

`front/FEATURE_IMPLEMENTATION.md`, `front/FORM_PERSISTENCE_DE.md`, and
`front/MCP_IMPLEMENTATION.md` describe this feature and reference components (`StructuredToolResponse`,
`structuredToolResponsesSlice`, `expectingToolResponse`, `mcpToolCall`) that **do not exist** in the
current tree. They should be treated as historical/aspirational. If this design is implemented, those
files should be reconciled (folded in or removed) so the repo does not keep two conflicting designs.
The component folder naming (`StructuredToolResponses/`) in those docs conflicts with the
screen-area convention in AGENTS.md §5; prefer `components/Conversation/MessageAssistant/ToolForm.jsx`.
