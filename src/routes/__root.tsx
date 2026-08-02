import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      {
        title: "Blueprint — URL → 1:1 frontend blueprint",
      },
      {
        name: "description",
        content:
          "Skenuj ľubovoľnú verejnú URL alebo vlož HTML a vytvor štruktúrovaný 1:1 frontend blueprint s exportom JSON/ZIP.",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="sk" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-dvh bg-bg text-fg antialiased">
        <Outlet />
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            className: "border border-border bg-bg-elevated text-fg",
          }}
        />
        <Scripts />
      </body>
    </html>
  );
}
