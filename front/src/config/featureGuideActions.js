const find = (selector) => document.querySelector(selector);
const click = (selector) => {
  const element = find(selector);
  if (!element) return false;
  element.click();
  return true;
};

function retry(check, attempts = 30, delay = 80) {
  let remaining = attempts;
  const tick = () => {
    let done = false;
    try {
      done = check();
    } catch {
      done = false;
    }
    if (done) return;
    remaining -= 1;
    if (remaining <= 0) return;
    window.setTimeout(tick, delay);
  };
  tick();
}

export function openTools() {
  if (!find('[data-guide="tools-enable"]')) {
    click('[data-guide="tools"]');
  }
}

export function openAgentTools() {
  if (!find('[data-guide="agent-recovery-tab"]')) {
    click('[data-guide="agent-tools-button"]');
  }
}

export function openAgentRecovery() {
  openAgentTools();
  retry(() => {
    const tab = find('[data-guide="agent-recovery-tab"]');
    if (!tab) return false;
    if (tab.getAttribute("aria-pressed") !== "true") tab.click();
    return true;
  });
}

export function ensureToolsEnabled() {
  openTools();
  retry(() => {
    const toggle = find('[data-guide="tools-enable"]');
    if (!toggle) return false;
    const input = toggle.querySelector('input[type="checkbox"]');
    if (!input) return false;
    if (input.checked) return true;
    toggle.click();
    return true;
  });
}

export function ensureTool(toolKey) {
  openTools();
  retry(() => {
    const toggle = find('[data-guide="tools-enable"]');
    if (!toggle) return false;
    const input = toggle.querySelector('input[type="checkbox"]');
    if (!input) return false;
    if (!input.checked) {
      toggle.click();
      return false;
    }
    const tool = find(`[data-guide="tool-${toolKey}"]`);
    if (!tool) return false;
    if (isToolActive(toolKey)) return true;
    // A tool with a settings page swaps the row for that page's switch, which
    // carries the same data-guide; the next tick finds it and flips it.
    tool.click();
    return false;
  });
}

export function openLocalTools() {
  if (!find('[data-guide="tool-image_analysis"]')) {
    click('[data-guide="local-tools"]');
  }
}

export function openUserSettings() {
  if (find('[data-guide="settings-tab-chat"]')) return;
  if (click('[data-guide="user-settings"]')) return;
  if (click(".user-profile-button")) return;
  click(".user-profile-block");
}

export function selectSettingsTab(tabId) {
  openUserSettings();
  retry(() => {
    const tab = find(`[data-guide="settings-tab-${tabId}"]`);
    if (!tab) return false;
    if (tab.getAttribute("aria-pressed") !== "true") {
      tab.click();
    }
    return true;
  });
}

/** The Data tab's own strip: `manage`, `backup` or `sync`. */
export function selectDataSection(section) {
  selectSettingsTab("data");
  retry(() => {
    const tab = find(`[data-guide="data-subtab-${section}"]`);
    if (!tab) return false;
    if (tab.getAttribute("aria-selected") !== "true") {
      tab.click();
    }
    return true;
  });
}

/** The Profile tab's own strip: `user` or `institution`. */
export function selectProfileSection(section) {
  selectSettingsTab("profile");
  retry(() => {
    const tab = find(`[data-guide="profile-subtab-${section}"]`);
    if (!tab) return false;
    if (tab.getAttribute("aria-selected") !== "true") {
      tab.click();
    }
    return true;
  });
}

export function openConversationSettings() {
  if (!find('[data-guide="conversation-settings-panel"]')) {
    click(".settings-toggle");
  }
}

export function openConversationMenu() {
  if (
    !find('[data-guide="export-chat"]') &&
    !find('[data-guide="summarize-chat"]')
  ) {
    click('[data-guide="conversation-menu"]');
  }
}

export function openTopicMenu() {
  if (!find('[data-guide="pin-topic-menu-item"]')) {
    click('[data-guide="topic-menu"]');
  }
}

export function openWorkspaceMenu() {
  if (!find('[data-guide="pin-workspace-menu-item"]')) {
    click('[data-guide="workspace-menu"]');
  }
}

export function openChatWorkspaces() {
  if (!find('[data-guide="manage-workspace"]')) {
    click('[data-guide="chat-workspaces"]');
  }
}

export function openWorkspaceAgents() {
  const tab = find('[data-guide="meta-tab-agents"]');
  if (tab && tab.getAttribute("aria-selected") !== "true") tab.click();
}

export function openWorkspaceFiles() {
  const tab = find('[data-guide="meta-tab-files"]');
  if (tab && tab.getAttribute("aria-selected") !== "true") tab.click();
}

export function openAgentMenu() {
  if (!find('[data-guide="pin-agent-menu-item"]')) {
    click('[data-guide="agent-menu"]');
  }
}

export function openSearch() {
  if (!find('[data-guide="search-input"]')) {
    click('[data-guide="search-chats"]');
  }
}

export function openSortMenu() {
  if (!find('[data-guide="sort-menu"]')) {
    click('[data-guide="sort-chats"]');
  }
}

export function openTopicCreate() {
  if (!find('[data-guide="topic-create-input"]')) {
    click('[data-guide="create-topic"]');
  }
}

export function isOutsideMetaChat() {
  return typeof window !== "undefined" && window.location.pathname !== "/meta";
}

export function hasAttachmentCard() {
  return !!find('[data-guide="attachment-card"]');
}

export function attachmentProcessed() {
  return hasAttachmentCard() && !find('[data-guide="process-file"]');
}

export function toolsPanelOpen() {
  return !!find('[data-guide="tools-enable"]');
}

export function toolsAreEnabled() {
  const toggle = find('[data-guide="tools-enable"]');
  const input = toggle?.querySelector('input[type="checkbox"]');
  return !!input?.checked;
}

export function isToolActive(toolKey) {
  const tool = find(`[data-guide="tool-${toolKey}"]`);
  if (!tool) return false;
  const pressed = tool.getAttribute("aria-pressed");
  if (pressed !== null) return pressed === "true";
  const checked = tool.getAttribute("aria-checked");
  if (checked !== null) return checked === "true";
  return tool.className.includes("border-success");
}

export function arcanaAddIdEntered() {
  const input = find('[data-guide="arcana-add-id"]');
  return !!input?.value?.trim();
}

/**
 * Open the first Arcana, make sure its editor panel is visible and switch it
 * to the Share tab.
 *
 * The tour runs from whatever screen the user is on, so it opens the page
 * itself. Clicking a row of the sidebar is enough; the tab click is retried
 * because the page mounts a moment later (it also has to read the collections
 * first, which is why the window is generous). The editor panel starts closed
 * on a narrow window, so the retry asks the header toggle to open it once.
 */
export function openArcanaShare() {
  if (!find('[data-guide="arcana-tab-share"]')) {
    click('[data-guide="arcana-row"]');
  }
  let askedForPanel = false;
  retry(
    () => {
      const tab = find('[data-guide="arcana-tab-share"]');
      if (tab) {
        tab.click();
        return true;
      }
      if (!askedForPanel) {
        const toggle = find('[data-guide="arcana-editor-toggle"]');
        if (toggle && toggle.getAttribute("aria-pressed") === "false") {
          toggle.click();
          askedForPanel = true;
        }
      }
      return false;
    },
    80,
  );
}

/**
 * Open the first Arcana and its Files tab, then wait for an editable row.
 *
 * The file rows only exist after the panel has read the collection, and the
 * Markdown editor button additionally needs a converted or text file. The tour
 * therefore waits for the button itself instead of the tab, and opens the panel
 * first on a narrow window.
 */
export function openArcanaFiles() {
  if (!find('[data-guide="arcana-manager"]')) {
    click('[data-guide="arcana-row"]');
  }
  let askedForPanel = false;
  retry(
    () => {
      if (find('[data-guide="arcana-edit-markdown"]')) return true;
      if (!askedForPanel) {
        const toggle = find('[data-guide="arcana-editor-toggle"]');
        if (toggle && toggle.getAttribute("aria-pressed") === "false") {
          toggle.click();
          askedForPanel = true;
          return false;
        }
      }
      find('[data-guide="arcana-tab-files"]')?.click();
      return false;
    },
    80,
  );
}

export function mcpConfigured() {
  const input = find('[data-guide="mcp-input"]');
  return !!input?.value?.trim();
}

export function userSettingsOpen() {
  return !!find('[data-guide="settings-tab-chat"]');
}

export function settingsTabActive(tabId) {
  const tab = find(`[data-guide="settings-tab-${tabId}"]`);
  return tab?.getAttribute("aria-pressed") === "true";
}

export function searchHasQuery() {
  const input = find('[data-guide="search-input"]');
  return !!input?.value?.trim();
}

export function topicNameEntered() {
  const input = find('[data-guide="topic-create-input"]');
  return !!input?.value?.trim();
}

export function conversationMenuOpen() {
  return !!find('[data-guide="export-chat"]') || !!find('[data-guide="summarize-chat"]');
}
