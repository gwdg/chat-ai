export const MANIFEST_FILENAME = "chat-ai-manifest.json";
export const MANIFEST_MAX_BYTES = 2 * 1024 * 1024;
export const MANIFEST_MAX_CHATS = 50;
export const MANIFEST_MAX_MESSAGES = 2000;

const isObject = (value) =>
  !!value && typeof value === "object" && !Array.isArray(value);

const fail = (message) => {
  throw new Error(`Invalid ${MANIFEST_FILENAME}: ${message}`);
};

const text = (value, field, max) => {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") fail(`${field} must be a string`);
  return value.trim().slice(0, max);
};

const optionalText = (value, field, max) => {
  const result = text(value, field, max);
  return result || undefined;
};

const validateMessages = (messages, index) => {
  if (!Array.isArray(messages)) {
    fail(`chats[${index}].messages must be an array`);
  }
  if (messages.length > MANIFEST_MAX_MESSAGES) {
    fail(`chats[${index}].messages exceeds ${MANIFEST_MAX_MESSAGES} messages`);
  }
  return messages.map((message, messageIndex) => {
    if (!isObject(message)) {
      fail(`chats[${index}].messages[${messageIndex}] must be an object`);
    }
    const role = String(message.role || "").toLowerCase();
    if (!["system", "user", "assistant"].includes(role)) {
      fail(`chats[${index}].messages[${messageIndex}].role is invalid`);
    }
    const content = message.content;
    if (
      typeof content !== "string" &&
      !(Array.isArray(content) && content.every(isObject))
    ) {
      fail(`chats[${index}].messages[${messageIndex}].content is invalid`);
    }
    return {
      ...message,
      role,
    };
  });
};

const validateChat = (chat, index) => {
  if (!isObject(chat)) fail(`chats[${index}] must be an object`);
  for (const key of ["user_settings", "conversations", "meta_chat"]) {
    if (key in chat) fail(`chats[${index}].${key} is not allowed`);
  }
  const title = text(chat.title, `chats[${index}].title`, 200);
  const folderName = optionalText(
    chat.folderName ?? chat.folder_name,
    `chats[${index}].folderName`,
    120,
  );
  const settings = isObject(chat.settings) ? { ...chat.settings } : {};
  for (const key of [
    "model",
    "model-name",
    "temperature",
    "top_p",
    "enable_tools",
    "tools",
    "mcp_servers",
    "memory_mode_override",
    "memory_group_override",
    "arcana",
  ]) {
    if (settings[key] === undefined && chat[key] !== undefined) {
      settings[key] = chat[key];
    }
  }
  const messages = validateMessages(chat.messages ?? [], index);
  return {
    title: title || "Imported Chat",
    ...(folderName ? { folderName } : {}),
    settings,
    messages,
  };
};

export function parseWorkspaceManifest(raw) {
  const value = typeof raw === "string" ? raw : JSON.stringify(raw ?? {});
  if (!value.trim()) fail("file is empty");
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    fail("file is not valid JSON");
  }
  if (!isObject(parsed)) fail("root must be an object");
  if (Number(parsed.schemaVersion) !== 1) {
    fail("schemaVersion must be 1");
  }

  const allowed = new Set(["schemaVersion", "workspace", "agent", "chats"]);
  for (const key of Object.keys(parsed)) {
    if (!allowed.has(key)) fail(`unknown top-level key "${key}"`);
  }

  const workspace = isObject(parsed.workspace)
    ? {
        name: optionalText(parsed.workspace.name, "workspace.name", 120),
        icon: optionalText(parsed.workspace.icon, "workspace.icon", 40),
        color: optionalText(parsed.workspace.color, "workspace.color", 20),
      }
    : undefined;
  if (workspace?.color && !/^#[0-9a-f]{6}$/i.test(workspace.color)) {
    fail("workspace.color must be a six-digit hex colour");
  }

  const initialMessage = (() => {
    const raw = parsed.agent?.initialMessage;
    if (typeof raw === "string" && raw.trim()) {
      return { text: raw.trim().slice(0, 10000) };
    }
    if (isObject(raw) && typeof raw.text === "string" && raw.text.trim()) {
      return {
        ...(optionalText(raw.title, "agent.initialMessage.title", 120)
          ? { title: optionalText(raw.title, "agent.initialMessage.title", 120) }
          : {}),
        text: raw.text.trim().slice(0, 10000),
      };
    }
    return undefined;
  })();

  const agent = isObject(parsed.agent)
    ? {
        name: optionalText(parsed.agent.name, "agent.name", 120),
        sessionTitle: optionalText(
          parsed.agent.sessionTitle,
          "agent.sessionTitle",
          200,
        ),
        model: optionalText(parsed.agent.model, "agent.model", 200),
        bridgeWritable:
          typeof parsed.agent.bridgeWritable === "boolean"
            ? parsed.agent.bridgeWritable
            : undefined,
        bridgeMcp:
          typeof parsed.agent.bridgeMcp === "boolean"
            ? parsed.agent.bridgeMcp
            : undefined,
        bridgeInjectExternal:
          typeof parsed.agent.bridgeInjectExternal === "boolean"
            ? parsed.agent.bridgeInjectExternal
            : undefined,
        ...(initialMessage ? { initialMessage } : {}),
      }
    : undefined;

  const chats = parsed.chats === undefined ? [] : parsed.chats;
  if (!Array.isArray(chats)) fail("chats must be an array");
  if (chats.length > MANIFEST_MAX_CHATS) {
    fail(`chats exceeds ${MANIFEST_MAX_CHATS} entries`);
  }

  const manifest = {
    schemaVersion: 1,
    ...(workspace && Object.values(workspace).some(Boolean)
      ? { workspace }
      : {}),
    ...(agent && Object.values(agent).some((value) => value !== undefined)
      ? { agent }
      : {}),
    chats: chats.map(validateChat),
  };

  if (new TextEncoder().encode(JSON.stringify(manifest)).length > MANIFEST_MAX_BYTES) {
    fail("normalized manifest is too large");
  }
  return manifest;
}
