import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ArcanaChatPanel from "../ArcanaChatPanel";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  t: vi.fn((key, options) =>
    options?.count !== undefined ? `${key}:${options.count}` : key,
  ),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mocks.t }),
}));

vi.mock("react-redux", () => ({
  useSelector: () => ({}),
  useDispatch: () => vi.fn(),
}));

vi.mock("../../../hooks/useArcanaChatSend", () => ({
  useArcanaChatSend: () => mocks.send,
}));

// The ordinary chat shell is not under test here: it only has to receive the
// thread, the placeholder and no close button.
vi.mock("../../Conversation/Conversation", () => ({
  default: ({ localState, hideCloseButton, promptPlaceholder }) => (
    <div
      data-testid="conversation"
      data-messages={localState.messages.length}
      data-hide-close={String(hideCloseButton)}
      data-placeholder={promptPlaceholder}
    />
  ),
}));

const collection = {
  name: "Paper pile",
  collection: "tester__papers",
  owner: "tester",
  role: "owner",
  can_write: true,
  can_manage: true,
  shared: false,
};

const THREAD_KEY = "chatai.arcana-chat:tester__papers";

const storedThread = () =>
  JSON.parse(window.sessionStorage.getItem(THREAD_KEY) ?? "null");

beforeEach(() => {
  window.sessionStorage.clear();
  mocks.send.mockReset();
});

describe("ArcanaChatPanel", () => {
  it("names the collection and what the chat does in one head panel", () => {
    render(<ArcanaChatPanel collection={collection} />);

    const banner = document.querySelector('[data-guide="arcana-chat-banner"]');
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toContain("Paper pile");
    expect(banner.textContent).toContain("arcanas.page_kind");
    expect(banner.textContent).toContain("arcana_chat.subtitle");
    expect(screen.getByTestId("conversation")).toHaveAttribute(
      "data-placeholder",
      "arcana_chat.prompt_placeholder",
    );
    expect(screen.getByTestId("conversation")).toHaveAttribute(
      "data-hide-close",
      "true",
    );
  });

  it("shows the file count only once the editor has read the collection", () => {
    const { rerender } = render(
      <ArcanaChatPanel collection={collection} fileCount={null} />,
    );

    const banner = () =>
      document.querySelector('[data-guide="arcana-chat-banner"]');

    expect(banner().textContent).not.toContain("arcanas.page_file_count");
    expect(banner().textContent).toContain("Paper pile");

    rerender(<ArcanaChatPanel collection={collection} fileCount={3} />);
    expect(banner().textContent).toContain("arcanas.page_file_count:3");
  });

  it("places the page's controls beside New chat", () => {
    render(
      <ArcanaChatPanel
        collection={collection}
        actions={<button type="button">Files and settings</button>}
      />,
    );

    const banner = document.querySelector('[data-guide="arcana-chat-banner"]');
    expect(
      banner.querySelector('[data-guide="arcana-chat-reset"]'),
    ).toBeInTheDocument();
    expect(banner.textContent).toContain("Files and settings");
  });

  it("keeps the thread across a remount and resets it on demand", () => {
    const { unmount } = render(
      <ArcanaChatPanel collection={collection} fileCount={1} />,
    );

    expect(screen.getByTestId("conversation")).toHaveAttribute(
      "data-messages",
      "2",
    );
    expect(storedThread()).not.toBeNull();

    // A stored thread is restored under the collection's storage name.
    window.sessionStorage.setItem(
      THREAD_KEY,
      JSON.stringify({
        messages: [
          { role: "system", content: [{ type: "text", text: "" }] },
          { role: "user", content: [{ type: "text", text: "hi" }] },
          { role: "assistant", content: [{ type: "text", text: "hello" }] },
        ],
        settings: {},
      }),
    );
    unmount();

    render(<ArcanaChatPanel collection={collection} fileCount={1} />);
    expect(screen.getByTestId("conversation")).toHaveAttribute(
      "data-messages",
      "3",
    );

    fireEvent.click(
      document.querySelector('[data-guide="arcana-chat-reset"]'),
    );
    expect(screen.getByTestId("conversation")).toHaveAttribute(
      "data-messages",
      "2",
    );
    expect(storedThread().messages).toHaveLength(2);
  });
});
