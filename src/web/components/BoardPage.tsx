import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { Actor } from "../../core/actions";
import type { Card } from "../../core/model";
import {
  action,
  boardQuery,
  cardQuery,
  errorMessage,
  queryClient,
  refresh,
  request,
  type BoardData,
} from "../api";
import { filterableFields, matchesFilters, type BoardSearch } from "../filters";
import { useUpdate } from "../update";
import { Toast } from "../ui";
import { Board } from "./Board";
import { CardDialog } from "./CardDialog";
import { CardList } from "./CardList";
import { Filters } from "./Filters";
import { Login } from "./Login";
const Settings = lazy(() => import("./Settings"));

const route = getRouteApi("/");
/** El tema que trae el sistema. Solo vale hasta que carga el perfil: la
 *  preferencia guardada manda, y es una acción, no estado del frontend. */
const systemTheme = matchMedia("(prefers-color-scheme: dark)").matches
  ? "dark"
  : "light";

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
  const navigate = useNavigate();
  const [toast, setToast] = useState("");
  const showError = useCallback((message: string) => setToast(message), []);
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => request<Actor>("/api/me"),
    retry: false,
  });
  const board = useQuery({
    ...boardQuery(search.view ?? "week"),
    enabled: !!me.data,
  });
  // El tema sale del perfil, no de un estado aparte: mientras la acción viaja,
  // el perfil del caché ya trae el valor nuevo, igual que una tarjeta.
  const theme =
    board.data?.profiles.find((profile) => profile.id === me.data?.userId)
      ?.theme ?? systemTheme;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  async function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
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
      await action("profile.preferences", { theme: next });
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
        const created = await action<Card>("card.create", { title, weekly });
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
      <header className="header">
        <Link to="/" search={{ view: "week" }} className="brand">
          Sloption
        </Link>
        <span className="subtitle">REVI / TAREAS</span>
        {search.view !== "archived" && (
          <nav aria-label="Vistas">
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
              search={(previous: BoardSearch) => ({ ...previous, view: "all" })}
              className={search.view === "all" ? "active" : ""}
            >
              Todas
            </Link>
          </nav>
        )}
        <button
          onClick={() => {
            void navigate({
              to: "/",
              search: (previous) => ({
                ...previous,
                settings: !previous.settings,
              }),
            });
          }}
        >
          Configuración
        </button>
        <button
          className="theme-toggle"
          aria-label={
            theme === "light" ? "Activar modo oscuro" : "Activar modo claro"
          }
          onClick={() => {
            void toggleTheme();
          }}
        >
          {theme === "light" ? "☾" : "☀"}
        </button>
        <button
          onClick={async () => {
            await request("/api/auth/sign-out", {});
            queryClient.clear();
            location.assign("/");
          }}
        >
          Salir
        </button>
      </header>
      <div className="board-heading">
        <div>
          <h1>
            {search.view === "archived"
              ? "Archivo"
              : search.view === "week"
                ? "Esta semana"
                : "Todas las tareas"}
          </h1>
          <p>
            {board.data ? visible.length : "—"} tarjetas
            {hidden > 0 && ` de ${board.data!.cards.length}`} ·{" "}
            {search.view === "week"
              ? "Lo que elegimos hacer ahora."
              : search.view === "archived"
                ? "Lo que ya salió del tablero."
                : "El trabajo del equipo, en un lugar."}
          </p>
        </div>
        <Link
          to="/"
          search={(previous: BoardSearch) => ({
            ...previous,
            view: search.view === "archived" ? "week" : "archived",
          })}
        >
          {search.view === "archived" ? "Volver al tablero" : "Ver archivadas"}
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
        (search.view === "week" ? (
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
      {toast && <Toast message={toast} onDismiss={() => setToast("")} />}
    </main>
  );
}
