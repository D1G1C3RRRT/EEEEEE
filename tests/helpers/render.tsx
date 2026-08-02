import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ReactElement } from "react";

// React 19 act environment for happy-dom
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

export type RenderResult = {
  container: HTMLElement;
  unmount: () => void;
  rerender: (ui: ReactElement) => void;
};

/** Minimal React mount helper (happy-dom / vitest) without testing-library. */
export function render(ui: ReactElement): RenderResult {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
    rerender: (next) => {
      act(() => {
        root.render(next);
      });
    },
  };
}

export function click(el: Element | null) {
  if (!el) throw new Error("click: element is null");
  act(() => {
    el.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, cancelable: true }),
    );
    el.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
    el.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, cancelable: true }),
    );
    el.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true, cancelable: true }),
    );
    el.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });
}

export function typeInput(
  el: HTMLInputElement | HTMLTextAreaElement | null,
  value: string,
) {
  if (!el) throw new Error("typeInput: element is null");
  act(() => {
    const proto =
      el instanceof HTMLTextAreaElement
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    desc?.set?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

export function getByText(container: HTMLElement, text: string | RegExp): HTMLElement {
  const all = [...container.querySelectorAll("*")] as HTMLElement[];
  const matches = all.filter((el) => {
    const t = (el.textContent || "").replace(/\s+/g, " ").trim();
    return typeof text === "string" ? t.includes(text) : text.test(t);
  });
  if (!matches.length) throw new Error(`getByText: not found ${text}`);
  return matches[matches.length - 1];
}

export function queryByText(
  container: HTMLElement,
  text: string | RegExp,
): HTMLElement | null {
  try {
    return getByText(container, text);
  } catch {
    return null;
  }
}

export async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}
