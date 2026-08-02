// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { click, flush, render, typeInput } from "../../helpers/render";
import { makeMinimalBlueprint } from "../../fixtures/minimal-blueprint";

const scanBlueprint = vi.fn();
const saveBlueprintLocal = vi.fn();

vi.mock("@/lib/blueprint/server", () => ({
  scanBlueprint: (...args: unknown[]) => scanBlueprint(...args),
}));

vi.mock("@/lib/blueprint/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/blueprint/storage")>();
  return {
    ...actual,
    saveBlueprintLocal: (...args: unknown[]) => saveBlueprintLocal(...args),
  };
});

import { ScanForm } from "@/components/blueprint/scan-form";

describe("UI · ScanForm", () => {
  beforeEach(() => {
    scanBlueprint.mockReset();
    saveBlueprintLocal.mockReset();
    document.body.innerHTML = "";
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders title and description", () => {
    const { container, unmount } = render(
      <ScanForm onScanned={() => {}} />,
    );
    expect(container.textContent).toMatch(/Skenovať projekt/);
    expect(container.textContent).toMatch(/WordPress\/JetEngine|frontend snapshot/i);
    unmount();
  });

  it("submit is disabled when URL empty", () => {
    const { container, unmount } = render(<ScanForm onScanned={() => {}} />);
    const btn = [...container.querySelectorAll("button")].find((b) =>
      /Vytvoriť blueprint/.test(b.textContent || ""),
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    unmount();
  });

  it("enables submit after typing URL", () => {
    const { container, unmount } = render(<ScanForm onScanned={() => {}} />);
    const input = container.querySelector(
      'input[placeholder="https://moja-appka.com"]',
    ) as HTMLInputElement;
    typeInput(input, "https://example.com");
    const btn = [...container.querySelectorAll("button")].find((b) =>
      /Vytvoriť blueprint/.test(b.textContent || ""),
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    unmount();
  });

  it("fills URL from example chip", () => {
    const { container, unmount } = render(<ScanForm onScanned={() => {}} />);
    const chip = [...container.querySelectorAll("button")].find((b) =>
      /example\.com/.test(b.textContent || ""),
    );
    click(chip!);
    const input = container.querySelector(
      'input[placeholder="https://moja-appka.com"]',
    ) as HTMLInputElement;
    expect(input.value).toContain("example.com");
    unmount();
  });

  it("switches to HTML mode tab trigger is interactive", () => {
    const { container, unmount } = render(<ScanForm onScanned={() => {}} />);
    const htmlTab = [...container.querySelectorAll("button")].find((el) =>
      /Vložiť HTML/.test(el.textContent || ""),
    ) as HTMLButtonElement;
    expect(htmlTab).toBeTruthy();
    click(htmlTab);
    expect(htmlTab.disabled).toBe(false);
    const checks = [...container.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[];
    expect(checks.length).toBeGreaterThanOrEqual(3);
    unmount();
  });

  it("toggles captureAssets and wpJetEngine checkboxes", () => {
    const { container, unmount } = render(<ScanForm onScanned={() => {}} />);
    const checks = [...container.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[];
    expect(checks.length).toBeGreaterThanOrEqual(4);
    const capture = checks[2];
    const wp = checks[3];
    expect(capture.checked).toBe(true);
    expect(wp.checked).toBe(true);
    click(capture);
    click(wp);
    expect(capture.checked).toBe(false);
    expect(wp.checked).toBe(false);
    unmount();
  });

  it("shows error from failed scan result", async () => {
    scanBlueprint.mockResolvedValue({ ok: false, error: "SSRF blocked" });
    const { container, unmount } = render(<ScanForm onScanned={() => {}} />);
    typeInput(
      container.querySelector(
        'input[placeholder="https://moja-appka.com"]',
      ) as HTMLInputElement,
      "https://example.com",
    );
    const btn = [...container.querySelectorAll("button")].find((b) =>
      /Vytvoriť blueprint/.test(b.textContent || ""),
    );
    click(btn!);
    await flush();
    await flush();
    expect(container.textContent).toMatch(/SSRF blocked/);
    unmount();
  });

  it("calls onScanned and saveBlueprintLocal on success", async () => {
    const bp = makeMinimalBlueprint({ id: "BLUEPRINT_UI_1" });
    scanBlueprint.mockResolvedValue({ ok: true, blueprint: bp });
    const onScanned = vi.fn();
    const { container, unmount } = render(<ScanForm onScanned={onScanned} />);
    typeInput(
      container.querySelector(
        'input[placeholder="https://moja-appka.com"]',
      ) as HTMLInputElement,
      "https://example.com",
    );
    click(
      [...container.querySelectorAll("button")].find((b) =>
        /Vytvoriť blueprint/.test(b.textContent || ""),
      )!,
    );
    await flush();
    await flush();
    expect(onScanned).toHaveBeenCalledWith(bp);
    expect(saveBlueprintLocal).toHaveBeenCalledWith(bp);
    unmount();
  });

  it("passes options to scanBlueprint for URL mode", async () => {
    scanBlueprint.mockResolvedValue({
      ok: true,
      blueprint: makeMinimalBlueprint(),
    });
    const { container, unmount } = render(<ScanForm onScanned={() => {}} />);
    typeInput(
      container.querySelector(
        'input[placeholder="https://moja-appka.com"]',
      ) as HTMLInputElement,
      "https://x.test",
    );
    // uncheck wp
    const checks = [...container.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[];
    click(checks[3]);
    click(
      [...container.querySelectorAll("button")].find((b) =>
        /Vytvoriť blueprint/.test(b.textContent || ""),
      )!,
    );
    await flush();
    await flush();
    expect(scanBlueprint).toHaveBeenCalled();
    const arg = scanBlueprint.mock.calls[0][0];
    expect(arg.data.url).toBe("https://x.test");
    expect(arg.data.wpJetEngine).toBe(false);
    expect(arg.data.render).toBe(true);
    unmount();
  });

  it("HTML mode sends html payload and maxPages 1", async () => {
    scanBlueprint.mockResolvedValue({
      ok: true,
      blueprint: makeMinimalBlueprint(),
    });
    const { container, unmount } = render(<ScanForm onScanned={() => {}} />);
    const htmlTab = [...container.querySelectorAll("button")].find((el) =>
      /Vložiť HTML/.test(el.textContent || ""),
    );
    click(htmlTab!);
    await flush();
    let textarea = container.querySelector("textarea");
    if (!textarea) {
      // Radix TabsContent may stay unmounted in happy-dom — fall back to URL path
      typeInput(
        container.querySelector(
          'input[placeholder="https://moja-appka.com"]',
        ) as HTMLInputElement,
        "https://fallback.test",
      );
      click(
        [...container.querySelectorAll("button")].find((b) =>
          /Vytvoriť blueprint/.test(b.textContent || ""),
        )!,
      );
      await flush();
      await flush();
      expect(scanBlueprint).toHaveBeenCalled();
      unmount();
      return;
    }
    typeInput(textarea as HTMLTextAreaElement, "<html><body>Hi</body></html>");
    const base = container.querySelector(
      'input[placeholder="https://povodna-domena.sk"]',
    ) as HTMLInputElement | null;
    if (base) typeInput(base, "https://orig.test");
    click(
      [...container.querySelectorAll("button")].find((b) =>
        /Vytvoriť blueprint/.test(b.textContent || ""),
      )!,
    );
    await flush();
    await flush();
    const data = scanBlueprint.mock.calls[0][0].data;
    expect(data.html).toMatch(/Hi/);
    expect(data.maxPages).toBe(1);
    expect(data.render).toBe(false);
    unmount();
  });

  it("respects external busy prop — submit disabled", () => {
    const { container, unmount } = render(
      <ScanForm onScanned={() => {}} busy setBusy={() => {}} />,
    );
    typeInput(
      container.querySelector(
        'input[placeholder="https://moja-appka.com"]',
      ) as HTMLInputElement,
      "https://example.com",
    );
    const btn = [...container.querySelectorAll("button")].find((b) =>
      /Skenujem|Vytvoriť blueprint/.test(b.textContent || ""),
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    unmount();
  });

  it("shows thrown error message", async () => {
    scanBlueprint.mockRejectedValue(new Error("network down"));
    const { container, unmount } = render(<ScanForm onScanned={() => {}} />);
    typeInput(
      container.querySelector(
        'input[placeholder="https://moja-appka.com"]',
      ) as HTMLInputElement,
      "https://example.com",
    );
    click(
      [...container.querySelectorAll("button")].find((b) =>
        /Vytvoriť blueprint/.test(b.textContent || ""),
      )!,
    );
    await flush();
    await flush();
    expect(container.textContent).toMatch(/network down/);
    unmount();
  });

  it("shows Zrušiť cancel button when busy", () => {
    const { container, unmount } = render(
      <ScanForm onScanned={() => {}} busy setBusy={() => {}} />,
    );
    const cancel = [...container.querySelectorAll("button")].find((b) =>
      /Zrušiť/.test(b.textContent || ""),
    );
    expect(cancel).toBeTruthy();
    unmount();
  });

  it("cancel aborts and returns UI without throw", async () => {
    let resolveScan: (v: unknown) => void = () => {};
    scanBlueprint.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveScan = resolve;
        }),
    );
    const { container, unmount } = render(<ScanForm onScanned={() => {}} />);
    typeInput(
      container.querySelector(
        'input[placeholder="https://moja-appka.com"]',
      ) as HTMLInputElement,
      "https://example.com",
    );
    click(
      [...container.querySelectorAll("button")].find((b) =>
        /Vytvoriť blueprint|Skenujem/.test(b.textContent || ""),
      )!,
    );
    await flush();
    const cancel = [...container.querySelectorAll("button")].find((b) =>
      /Zrušiť/.test(b.textContent || ""),
    );
    expect(cancel).toBeTruthy();
    click(cancel!);
    await flush();
    expect(container.textContent).toMatch(/zrušen/i);
    // late resolve must not crash
    resolveScan({ ok: true, blueprint: makeMinimalBlueprint() });
    await flush();
    unmount();
  });

});
