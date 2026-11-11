import type { Locator, Page } from "playwright";

const MARK_ATTR = "data-e2e-id";
const OVERLAY_ATTR = "data-e2e-overlay";

/**
 * Number every visible interactive element and draw a label on it (set-of-marks).
 * The VLM refers to elements by number instead of guessing pixel coordinates.
 * Runs in the page; must be self-contained.
 */
function markElements([markAttr, overlayAttr]: string[]): string[] {
    document.querySelectorAll(`[${overlayAttr}]`).forEach((e) => e.remove());
    // Drop last step's numbers, else a stale element can share an id with a current one
    document.querySelectorAll(`[${markAttr}]`).forEach((e) => e.removeAttribute(markAttr));
    const sel =
        "a,button,input,textarea,select,summary,[role=button],[role=link],[role=tab]," +
        "[role=menuitem],[role=checkbox],[role=radio],[contenteditable=true]";
    const out: string[] = [];
    let id = 0;

    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
        const r = el.getBoundingClientRect();
        const onScreen = r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0
            && r.top < innerHeight && r.left < innerWidth;
        const hidden = getComputedStyle(el).visibility === "hidden";
        if (!onScreen || hidden || (el as HTMLButtonElement).disabled) {
            continue;
        }

        id++;
        el.setAttribute(markAttr, String(id));
        const input = el as HTMLInputElement;
        const label = (el.getAttribute("aria-label") || el.innerText || input.value
            || input.placeholder || el.title || "").trim().replace(/\s+/g, " ").slice(0, 60);
        const type = input.type ? ` type=${input.type}` : "";
        out.push(`[${id}] <${el.tagName.toLowerCase()}${type}> ${label}`);

        const tag = document.createElement("div");
        tag.setAttribute(overlayAttr, "");
        tag.textContent = String(id);
        Object.assign(tag.style, {
            position: "fixed", left: `${r.left}px`, top: `${Math.max(r.top - 12, 0)}px`,
            background: "#e11d48", color: "#fff", font: "bold 11px monospace",
            padding: "0 3px", zIndex: "2147483647", pointerEvents: "none",
        });
        // Open popovers/dialogs sit in the top layer and would cover labels attached to <body>
        const layer = el.closest(":popover-open, dialog[open]") ?? document.body;
        layer.appendChild(tag);
    }
    return out;
}

/** Screenshot with element labels (exactly what the VLM sees), plus the matching text list. */
export async function observe(page: Page): Promise<{ shot: Buffer; elements: string[] }> {
    const elements = await page.evaluate(markElements, [MARK_ATTR, OVERLAY_ATTR]);
    const shot = await page.screenshot();
    await page.evaluate((attr) => document.querySelectorAll(`[${attr}]`).forEach((e) => e.remove()), OVERLAY_ATTR);
    return { shot, elements };
}

export function element(page: Page, id: number): Locator {
    return page.locator(`[${MARK_ATTR}='${id}']`).first();
}
