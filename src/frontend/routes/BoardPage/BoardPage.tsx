import "./BoardPage.css";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { Actor } from "@/backend/lib/endpoint";
import type { Card } from "@/backend/domains/kernel";
import {
  action,
  boardQuery,
  cardQuery,
  errorMessage,
  queryClient,
  refresh,
  request,
  type BoardData,
} from "@/frontend/lib/api";
import {
  filterableFields,
  matchesFilters,
  type BoardSearch,
} from "@/frontend/lib/filters";
import { useUpdate } from "@/frontend/lib/update";
import { Icon, Toast } from "@/frontend/ui";
import { AppSidebar } from "@/frontend/components/AppSidebar/AppSidebar";
import { Board } from "@/frontend/components/Board/Board";
import { CardDialog } from "@/frontend/components/CardDialog/CardDialog";
import { CardList } from "@/frontend/components/CardList/CardList";
import { Filters } from "@/frontend/components/Filters/Filters";
import { Login } from "@/frontend/components/Login/Login";
const Settings = lazy(() => import("@/frontend/components/Settings/Settings"));
const BoardFields = lazy(
  () => import("@/frontend/components/BoardFields/BoardFields"),
);

const route = getRouteApi("/");
/** El tema que pide el sistema operativo. No es estado de la aplicación: es un
 *  dato del dispositivo, y cambia mientras la pestaña está abierta. Lo usa
 *  quien eligió "sistema" como preferencia, y también quien todavía no eligió. */
const systemQuery = matchMedia("(prefers-color-scheme: dark)");
const watchSystemTheme = (notify: () => void) => {
  systemQuery.addEventListener("change", notify);
  return () => systemQuery.removeEventListener("change", notify);
};
const readSystemTheme = () => (systemQuery.matches ? "dark" : "light");
/** Bajo este ancho la barra tapa la pantalla, así que arranca cerrada. */
const wideQuery = matchMedia("(min-width: 900px)");
const VIEWS: Record<string, { title: string; hint: string }> = {
  week: { title: "Esta semana", hint: "Lo que elegimos hacer ahora." },
  all: {
    title: "Todas las tareas",
    hint: "El trabajo del equipo, en un lugar.",
  },
  archived: { title: "Archivo", hint: "Lo que ya salió del tablero." },
};

function transition(work: () => void) {
  if (
    document.startViewTransition &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    document.startViewTransition(work);
  else work();
}

export function BoardPage() {
  const search = route.useSearch();
  const view = search.view ?? "week";
  /** El archivo es una lista aparte: no lleva pestañas ni propiedades. */
  const isBoard = view === "week" || view === "all";
  const navigate = useNavigate();
  const [toast, setToast] = useState("");
  /** El cajón de navegación solo existe bajo 900px: en escritorio la barra
   *  está siempre. Es la posición de un panel, no un dato del tablero. */
  const [nav, setNav] = useState(() => wideQuery.matches);
  const showError = useCallback((message: string) => setToast(message), []);
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => request<Actor>("/api/session/me"),
    retry: false,
  });
  const board = useQuery({
    ...boardQuery(view),
    enabled: !!me.data,
  });
  // El tema sale del perfil, no de un estado aparte: mientras la acción viaja,
  // el perfil del caché ya trae el valor nuevo, igual que una tarjeta.
  const systemTheme = useSyncExternalStore(watchSystemTheme, readSystemTheme);
  const preference =
    board.data?.profiles.find((profile) => profile.id === me.data?.userId)
      ?.theme ?? "system";
  const theme = preference === "system" ? systemTheme : preference;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  async function setTheme(next: "light" | "dark" | "system") {
    const caches = queryClient.getQueriesData<BoardData>({
      queryKey: ["board"],
    });
    for (const [key, data] of caches)
      if (data)
        queryClient.setQueryData(key, {
          ...data,
          profiles: data.profiles.map((profile) =>
            profile.id === me.data?.userId
              ? { ...profile, theme: next }
              : profile,
          ),
        });
    try {
      await action("profiles.preferences", { theme: next });
      refresh();
    } catch (error) {
      for (const [key, data] of caches) queryClient.setQueryData(key, data);
      showError(errorMessage(error));
    }
  }
  const detail = useQuery({
    ...cardQuery(search.card ?? ""),
    enabled: !!me.data && !!search.card,
  });
  useEffect(() => {
    if (!me.data) return;
    const stream = new EventSource("/api/events");
    const invalidate = () => refresh();
    stream.addEventListener("change", invalidate);
    stream.addEventListener("ready", invalidate);
    return () => stream.close();
  }, [me.data]);
  useEffect(() => {
    if (!board.data) return;
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    if (!connection?.saveData && !/2g/.test(connection?.effectiveType ?? ""))
      void queryClient.prefetchQuery(
        boardQuery(search.view === "week" ? "all" : "week"),
      );
  }, [board.data, search.view]);
  const filterable = board.data
    ? filterableFields(board.data.fields, board.data.board.groupingId)
    : [];
  const visible = board.data
    ? board.data.cards.filter((card) =>
        matchesFilters(card, filterable, search),
      )
    : [];
  const hidden = (board.data?.cards.length ?? 0) - visible.length;
  const update = useUpdate(showError);
  const open = useCallback(
    (id: string) => {
      transition(() => {
        void navigate({
          to: "/",
          search: (previous) => ({ ...previous, card: id }),
        });
      });
    },
    [navigate],
  );
  const create = useCallback(
    async (title: string, weekly: boolean) => {
      try {
        const created = await action<Card>("cards.create", { title, weekly });
        refresh();
        // Crear es el principio de escribir la tarjeta, no el final.
        open(created.id);
      } catch (error) {
        showError(errorMessage(error));
      }
    },
    [open, showError],
  );
  const close = useCallback(() => {
    transition(() => {
      void navigate({
        to: "/",
        search: (previous) => ({ ...previous, card: undefined }),
      });
    });
  }, [navigate]);
  if (search.invite) return <Login invite={search.invite} onDone={() => {}} />;
  if (me.isPending)
    return <main className="loading" aria-label="Cargando sesión" />;
  if (!me.data)
    return (
      <Login
        onDone={() => {
          void queryClient.invalidateQueries({ queryKey: ["me"] });
        }}
      />
    );
  return (
    <main className="app">
      <a className="skip-link" href="#board-content">
        Ir al tablero
      </a>
      <AppSidebar
        open={nav}
        onOpenChange={setNav}
        name={
          board.data?.profiles.find((profile) => profile.id === me.data?.userId)
            ?.name ?? "Mi cuenta"
        }
        role={me.data.role}
        onSettings={() => {
          void navigate({
            to: "/",
            search: (previous) => ({ ...previous, settings: true }),
          });
        }}
        onSignOut={async () => {
          await request("/api/auth/sign-out", {});
          queryClient.clear();
          location.assign("/");
        }}
      />
      <div className="app-main">
        <div className="board-heading">
          <button
            className="nav-toggle"
            aria-label="Abrir navegación"
            onClick={() => setNav(true)}
          >
            <Icon name="menu" />
          </button>
          <div className="heading-text">
            <h1>{VIEWS[view]!.title}</h1>
            <p>
              {board.data ? visible.length : "—"} tarjetas
              {hidden > 0 && ` de ${board.data!.cards.length}`} ·{" "}
              {VIEWS[view]!.hint}
            </p>
          </div>
          {isBoard && (
            <nav aria-label="Vistas" className="view-tabs">
              <Link
                to="/"
                search={(previous: BoardSearch) => ({
                  ...previous,
                  view: "week",
                })}
                className={search.view === "week" ? "active week-tab" : ""}
              >
                Esta semana
              </Link>
              <Link
                to="/"
                search={(previous: BoardSearch) => ({
                  ...previous,
                  view: "all",
                })}
                className={search.view === "all" ? "active" : ""}
              >
                Todas
              </Link>
            </nav>
          )}
          {isBoard && me.data.role === "admin" && (
            <button
              className="heading-link"
              onClick={() => {
                void navigate({
                  to: "/",
                  search: (previous) => ({ ...previous, fields: true }),
                });
              }}
            >
              Propiedades
            </button>
          )}
          <Link
            className="heading-link"
            to="/"
            search={(previous: BoardSearch) => ({
              ...previous,
              view: isBoard ? "archived" : "week",
            })}
          >
            {isBoard ? "Ver archivadas" : "Volver al tablero"}
          </Link>
        </div>
        {board.data && (
          <Filters
            filterable={filterable}
            profiles={board.data.profiles}
            search={search}
            hidden={hidden}
          />
        )}
        {board.error && <p role="alert">{errorMessage(board.error)}</p>}
        {board.data &&
          (view === "week" ? (
            <Board
              data={{ ...board.data, cards: visible }}
              open={open}
              update={update}
              onError={showError}
              isAdmin={me.data?.role === "admin"}
            />
          ) : (
            <CardList
              groups={
                search.view === "archived"
                  ? [{ title: "Archivadas", cards: visible }]
                  : [
                      {
                        title: "Esta semana",
                        color: 2,
                        cards: visible.filter((card) => card.weekly),
                        create: (title: string) => void create(title, true),
                      },
                      {
                        title: "Backlog",
                        cards: visible.filter((card) => !card.weekly),
                        create: (title: string) => void create(title, false),
                      },
                    ]
              }
              fields={board.data.fields}
              profiles={board.data.profiles}
              groupingId={board.data.board.groupingId}
              open={open}
            />
          ))}
        {search.card && detail.data && board.data && (
          <CardDialog
            card={detail.data}
            fields={board.data.fields}
            profiles={board.data.profiles}
            close={close}
            update={update}
            onError={showError}
          />
        )}
        {search.card && detail.error && (
          <div className="error" role="alert">
            {errorMessage(detail.error)}
            <button onClick={close}>Cerrar</button>
          </div>
        )}
        {search.settings && (
          <Suspense fallback={<p>Cargando configuración…</p>}>
            <Settings
              actor={me.data}
              board={board.data}
              theme={theme}
              onTheme={(next) => {
                void setTheme(next);
              }}
              onError={showError}
              close={() => {
                void navigate({
                  to: "/",
                  search: (previous) => ({ ...previous, settings: false }),
                });
              }}
            />
          </Suspense>
        )}
      </div>
      {search.fields && me.data.role === "admin" && (
        <Suspense fallback={<p>Cargando propiedades…</p>}>
          <BoardFields
            board={board.data}
            onError={showError}
            close={() => {
              void navigate({
                to: "/",
                search: (previous) => ({ ...previous, fields: false }),
              });
            }}
          />
        </Suspense>
      )}
      {toast && <Toast message={toast} onDismiss={() => setToast("")} />}
    </main>
  );
}
