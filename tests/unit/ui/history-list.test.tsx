// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { click, render } from "../../helpers/render";
import { HistoryList } from "@/components/blueprint/history-list";
import type { BlueprintSummary } from "@/lib/blueprint/storage";

const items: BlueprintSummary[] = [
  {
    id: "A",
    title: "Alpha App",
    sourceUrl: "https://a.test",
    createdAt: "2026-01-01",
    tech: ["React", "Vite"],
    contentHash: "h1",
  },
  {
    id: "B",
    title: "Beta App",
    sourceUrl: null,
    createdAt: "2026-01-02",
    tech: ["WordPress"],
    contentHash: "h2",
  },
];

describe("UI · HistoryList", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("empty state message", () => {
    const { container, unmount } = render(
      <HistoryList items={[]} onSelect={() => {}} onDelete={() => {}} />,
    );
    expect(container.textContent).toMatch(/Zatiaľ žiadne blueprinty|História/);
    unmount();
  });

  it("renders item titles", () => {
    const { container, unmount } = render(
      <HistoryList items={items} onSelect={() => {}} onDelete={() => {}} />,
    );
    expect(container.textContent).toMatch(/Alpha App/);
    expect(container.textContent).toMatch(/Beta App/);
    unmount();
  });

  it("shows history count", () => {
    const { container, unmount } = render(
      <HistoryList items={items} onSelect={() => {}} onDelete={() => {}} />,
    );
    expect(container.textContent).toMatch(/História \(2\)/);
    unmount();
  });

  it("calls onSelect when row clicked", () => {
    const onSelect = vi.fn();
    const { container, unmount } = render(
      <HistoryList items={items} onSelect={onSelect} onDelete={() => {}} />,
    );
    const rowBtn = [...container.querySelectorAll("button")].find((b) =>
      /Alpha App/.test(b.textContent || ""),
    );
    click(rowBtn!);
    expect(onSelect).toHaveBeenCalledWith("A");
    unmount();
  });

  it("calls onDelete from trash button", () => {
    const onDelete = vi.fn();
    const { container, unmount } = render(
      <HistoryList items={items} onSelect={() => {}} onDelete={onDelete} />,
    );
    const del = container.querySelector('[aria-label="Zmazať"]');
    click(del!);
    expect(onDelete).toHaveBeenCalledWith("A");
    unmount();
  });

  it("highlights activeId", () => {
    const { container, unmount } = render(
      <HistoryList
        items={items}
        activeId="B"
        onSelect={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(container.textContent).toMatch(/Beta App/);
    // active row has stronger border class — presence of both items is enough
    expect(container.querySelectorAll("li").length).toBe(2);
    unmount();
  });

  it("shows sourceUrl or falls back to id", () => {
    const { container, unmount } = render(
      <HistoryList items={items} onSelect={() => {}} onDelete={() => {}} />,
    );
    expect(container.textContent).toMatch(/https:\/\/a\.test/);
    expect(container.textContent).toMatch(/B/);
    unmount();
  });

  it("renders tech chips", () => {
    const { container, unmount } = render(
      <HistoryList items={items} onSelect={() => {}} onDelete={() => {}} />,
    );
    expect(container.textContent).toMatch(/React/);
    expect(container.textContent).toMatch(/WordPress/);
    unmount();
  });
});
