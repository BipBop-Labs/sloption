import { createRoot } from "react-dom/client";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./api";
import { RESERVED, type BoardSearch } from "./filters";
import { ConfirmProvider } from "./ui";
import { BoardPage } from "./components/BoardPage";
import "./styles.css";

const rootRoute = createRootRoute({ component: Outlet });
const boardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: (search: Record<string, unknown>): BoardSearch => ({
    view: ["week", "all", "archived", "history"].includes(String(search.view))
      ? String(search.view)
      : "week",
    card: typeof search.card === "string" ? search.card : undefined,
    settings: search.settings === true || search.settings === "true",
    invite: typeof search.invite === "string" ? search.invite : undefined,
    q: typeof search.q === "string" && search.q ? search.q : undefined,
    ...Object.fromEntries(
      Object.entries(search).filter(
        ([key, value]) =>
          !RESERVED.includes(key) && typeof value === "string" && value,
      ),
    ),
  }),
  component: BoardPage,
});
const router = createRouter({
  routeTree: rootRoute.addChildren([boardRoute]),
  defaultPreload: "intent",
  defaultPreloadDelay: 50,
  defaultPreloadStaleTime: 30_000,
});
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <ConfirmProvider>
      <RouterProvider router={router} />
    </ConfirmProvider>
  </QueryClientProvider>,
);
