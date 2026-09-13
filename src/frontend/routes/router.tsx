import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { RESERVED, type BoardSearch } from "@/frontend/lib/filters";
import { BoardPage } from "./BoardPage/BoardPage";

/** El árbol de rutas. Una ruta es lo que el router monta y lo que la URL
 *  nombra; su componente vive en `routes/`. Todo lo demás —el cajón de la
 *  tarjeta, configuración, propiedades— es un panel de esta misma ruta abierto
 *  por un parámetro de búsqueda, y vive en `components/`. */
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
    fields: search.fields === true || search.fields === "true",
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

export const router = createRouter({
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
