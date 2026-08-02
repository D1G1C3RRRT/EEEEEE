import { Trash2, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BlueprintSummary } from "@/lib/blueprint/storage";

type Props = {
  items: BlueprintSummary[];
  activeId?: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
};

export function HistoryList({ items, activeId, onSelect, onDelete }: Props) {
  if (items.length === 0) {
    return (
      <div className="panel p-5 text-sm text-fg-muted">
        <div className="flex items-center gap-2 text-fg">
          <History className="size-4" />
          <span className="font-medium">História</span>
        </div>
        <p className="mt-2">Zatiaľ žiadne blueprinty. Spusti prvý sken.</p>
      </div>
    );
  }

  return (
    <div className="panel p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <History className="size-4 text-fg-muted" />
        <h3 className="text-sm font-semibold">História ({items.length})</h3>
      </div>
      <ul className="space-y-2">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <li key={item.id}>
              <div
                className={`group flex items-start gap-2 rounded-[var(--radius-md)] border px-3 py-2.5 transition-colors ${
                  active
                    ? "border-border-strong bg-bg-subtle"
                    : "border-border bg-bg/40 hover:bg-bg-subtle/80"
                }`}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => onSelect(item.id)}
                >
                  <div className="truncate text-sm font-medium text-fg">
                    {item.title}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] mono text-fg-subtle">
                    {item.sourceUrl || item.id}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {item.tech.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-bg-elevated border border-border px-1.5 py-0.5 text-[10px] text-fg-muted"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0 opacity-70 hover:opacity-100"
                  aria-label="Zmazať"
                  onClick={() => onDelete(item.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
