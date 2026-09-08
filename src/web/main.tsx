import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  memo,
} from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  Outlet,
  Link,
  useNavigate,
} from "@tanstack/react-router";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import type { Actor } from "../core/actions";
import type { Card, Field, Profile, Value } from "../core/model";
import {
  action,
  boardQuery,
  cardQuery,
  errorMessage,
  queryClient,
  refresh,
  request,
  type BoardData,
} from "./api";
import { Chip, chipColor, DropdownSelect } from "./dropdown";
import { ConfirmProvider, useConfirm } from "./confirm";
import { Icon } from "./icon";
import "./styles.css";
const DocumentEditor = lazy(() => import("./editor"));
const Settings = lazy(() => import("./settings"));

function transition(work: () => void) {
  if (
    document.startViewTransition &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    document.startViewTransition(work);
  else work();
}

function Login({ invite, onDone }: { invite?: string; onDone(): void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="login">
      <h1>Sloption</h1>
      <p>El tablero de Revi.</p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          const data = new FormData(event.currentTarget);
          try {
            if (invite)
              await request("/api/invitations/accept", {
                token: invite,
                name: data.get("name"),
                password: data.get("password"),
              });
            else
              await request("/api/auth/sign-in/email", {
                email: data.get("email"),
                password: data.get("password"),
              });
            if (invite) location.assign("/");
            else onDone();
          } catch (error) {
            setError(errorMessage(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        {invite ? (
          <label>
            Nombre
            <input name="name" autoComplete="name" required />
          </label>
        ) : (
          <label>
            Correo
            <input name="email" type="email" autoComplete="username" required />
          </label>
        )}
        <label>
          Contraseña
          <input
            name="password"
            type="password"
            minLength={12}
            autoComplete={invite ? "new-password" : "current-password"}
            required
          />
        </label>
        {invite && <p>Usa al menos 12 caracteres.</p>}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {invite ? "Aceptar invitación" : "Entrar"}
        </button>
      </form>
      {!invite && (
        <p className="help">
          El acceso es por invitación. Pídele un enlace a un administrador.
        </p>
      )}
    </main>
  );
}
function Shell() {
  return <Outlet />;
}
function BoardPage() {
  const search = boardRoute.useSearch();
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
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const savedTheme = board.data?.profiles.find(
    (profile) => profile.id === me.data?.userId,
  )?.theme;
  useEffect(() => {
    if (savedTheme) setTheme(savedTheme);
  }, [savedTheme]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  async function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    try {
      await action("profile.preferences", { theme: next });
      refresh();
    } catch (error) {
      setTheme(theme);
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
  const update = useCallback(
    async (
      name: string,
      input: Record<string, unknown>,
      optimistic?: Partial<Card>,
    ) => {
      const caches = queryClient.getQueriesData<BoardData>({
        queryKey: ["board"],
      });
      const previousCard = queryClient.getQueryData<Card>(["card", input.id]);
      if (name === "card.update") {
        const current =
          previousCard ??
          caches
            .flatMap(([, data]) => data?.cards ?? [])
            .find((card) => card.id === input.id);
        if (current)
          optimistic = {
            ...(typeof input.title === "string" ? { title: input.title } : {}),
            values: {
              ...current.values,
              ...(input.values as Record<string, Value> | undefined),
            },
          };
      }
      if (name === "card.move") {
        const data = caches.find(([, data]) =>
          data?.cards.some((card) => card.id === input.id),
        )?.[1];
        const current = data?.cards.find((card) => card.id === input.id);
        if (data && current) {
          const before = data.cards.find((card) => card.id === input.beforeId);
          optimistic = {
            values: {
              ...current.values,
              [data.board.groupingId]: input.optionId as Value,
            },
            rank: before
              ? before.rank - 0.5
              : Math.max(0, ...data.cards.map((card) => card.rank)) + 1024,
          };
        }
      }
      if (optimistic) {
        void queryClient.cancelQueries({ queryKey: ["board"] });
        void queryClient.cancelQueries({ queryKey: ["card", input.id] });
        if (previousCard)
          queryClient.setQueryData(["card", input.id], {
            ...previousCard,
            ...optimistic,
          });
        for (const [key, data] of caches)
          if (data)
            queryClient.setQueryData(key, {
              ...data,
              cards: data.cards
                .map((card) =>
                  card.id === input.id ? { ...card, ...optimistic } : card,
                )
                .filter((card) =>
                  key[1] === "archived"
                    ? card.archived
                    : !card.archived && (key[1] !== "week" || card.weekly),
                )
                .sort((a, b) => a.rank - b.rank),
            });
      }
      try {
        const result = await action<Card>(name, input);
        if (result.id) queryClient.setQueryData(["card", result.id], result);
        refresh();
      } catch (error) {
        if (previousCard)
          queryClient.setQueryData(["card", input.id], previousCard);
        for (const [key, data] of caches) queryClient.setQueryData(key, data);
        showError(errorMessage(error));
        refresh();
      }
    },
    [showError],
  );
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
        <nav aria-label="Vistas">
          <Link
            to="/"
            search={{ view: "week" }}
            className={search.view === "week" ? "active week-tab" : ""}
          >
            Esta semana
          </Link>
          <Link
            to="/"
            search={{ view: "all" }}
            className={search.view === "all" ? "active" : ""}
          >
            Todas
          </Link>
        </nav>
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
            {board.data?.cards.length ?? "—"} tarjetas ·{" "}
            {search.view === "week"
              ? "Lo que elegimos hacer ahora."
              : "El trabajo del equipo, en un lugar."}
          </p>
        </div>
        <Link
          to="/"
          search={{ view: search.view === "archived" ? "all" : "archived" }}
        >
          {search.view === "archived" ? "Volver al tablero" : "Ver archivadas"}
        </Link>
      </div>
      {board.error && <p role="alert">{errorMessage(board.error)}</p>}
      {board.data && (
        <Board
          data={board.data}
          view={search.view ?? "week"}
          open={open}
          update={update}
          onError={showError}
          isAdmin={me.data?.role === "admin"}
        />
      )}
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
      {toast &&
        createPortal(
          <div role="alert" className="toast">
            {toast}
            <button aria-label="Cerrar mensaje" onClick={() => setToast("")}>
              ×
            </button>
          </div>,
          Array.from(document.querySelectorAll("dialog[open]")).at(-1) ??
            document.body,
        )}
    </main>
  );
}

type Update = (
  name: string,
  input: Record<string, unknown>,
  optimistic?: Partial<Card>,
) => Promise<void>;
function Board({
  data,
  view,
  open,
  update,
  onError,
  isAdmin,
}: {
  data: BoardData;
  view: string;
  open(id: string): void;
  update: Update;
  onError(message: string): void;
  isAdmin: boolean;
}) {
  const confirm = useConfirm();
  const [newStage, setNewStage] = useState("");
  /** Las columnas son las opciones del campo de agrupación: agregar y quitar
   *  una etapa es una sola acción, field.update, que además limpia el valor en
   *  las tarjetas que la usaban. */
  async function saveStages(
    options: { id: string; label: string }[],
  ): Promise<void> {
    if (!grouping) return;
    try {
      await action("field.update", {
        id: grouping.id,
        name: grouping.name,
        options,
      });
      refresh();
    } catch (error) {
      onError(errorMessage(error));
    }
  }
  // setDrop tiene identidad estable, así que CardTile sigue memoizado.
  const [drop, setDrop] = useState<(DropTarget & { height: number }) | null>(
    null,
  );
  const grouping = data.fields.find(
    (field) => field.id === data.board.groupingId,
  );
  const options = [
    ...(grouping?.options ?? []),
    { id: "", label: "Sin estado" },
  ];
  return (
    <div id="board-content" className="board" aria-label="Tablero kanban">
      {options.map((option, index) => {
        const cards = data.cards.filter(
          (card) => (card.values[data.board.groupingId] ?? "") === option.id,
        );
        // "" = al final de la columna; un id = justo antes de esa tarjeta.
        const slot =
          drop && (drop.optionId ?? "") === option.id
            ? (drop.beforeId ?? "")
            : null;
        return (
          <section className="column" key={option.id} data-option={option.id}>
            <header className="column-header">
              <h2>
                <Chip color={option.id ? chipColor(option.id) : undefined}>
                  {option.label}
                </Chip>
              </h2>
              <span>{cards.length}</span>
              {isAdmin && option.id && (
                <button
                  className="stage-remove"
                  aria-label={`Eliminar etapa ${option.label}`}
                  onClick={async () => {
                    if (
                      await confirm({
                        title: `¿Eliminar la etapa "${option.label}"?`,
                        message: cards.length
                          ? `${cards.length} tarjeta(s) quedarán sin estado. No se borra ninguna.`
                          : "La columna desaparece del tablero.",
                        confirmLabel: "Eliminar etapa",
                        destructive: true,
                      })
                    )
                      void saveStages(
                        (grouping?.options ?? []).filter(
                          (item) => item.id !== option.id,
                        ),
                      );
                  }}
                >
                  <Icon name="trash" />
                </button>
              )}
            </header>
            <div className="cards">
              {cards.map((card) => (
                <React.Fragment key={card.id}>
                  {slot === card.id && (
                    <div className="drop-slot" style={{ height: drop!.height }} />
                  )}
                  <CardTile
                    card={card}
                    fields={data.fields}
                    profiles={data.profiles}
                    open={open}
                    update={update}
                    preview={setDrop}
                  />
                </React.Fragment>
              ))}
              {slot === "" && (
                <div className="drop-slot" style={{ height: drop!.height }} />
              )}
            </div>
            {view !== "archived" && (
              <form
                className="new-card"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const title = String(
                    new FormData(form).get("title") ?? "",
                  ).trim();
                  if (!title) return;
                  try {
                    const created = await action<Card>("card.create", {
                      title,
                      values: { [data.board.groupingId]: option.id || null },
                      weekly: view === "week",
                    });
                    form.reset();
                    refresh();
                    // Crear es el principio de escribir la tarjeta, no el final.
                    open(created.id);
                  } catch (error) {
                    onError(errorMessage(error));
                  }
                }}
              >
                <input
                  name="title"
                  aria-label={`Nueva tarjeta en ${option.label}`}
                  placeholder="+ Nueva tarea"
                  required
                />
                <button aria-label={`Crear tarjeta en ${option.label}`}>
                  ↵
                </button>
              </form>
            )}
          </section>
        );
      })}
      {isAdmin && grouping && (
        <form
          className="column add-stage"
          onSubmit={(event) => {
            event.preventDefault();
            const label = newStage.trim();
            if (!label) return;
            setNewStage("");
            void saveStages([
              ...(grouping.options ?? []),
              { id: crypto.randomUUID(), label },
            ]);
          }}
        >
          <input
            value={newStage}
            onChange={(event) => setNewStage(event.target.value)}
            aria-label="Nombre de la nueva etapa"
            placeholder="Nueva etapa"
            required
          />
          <button aria-label="Agregar etapa">
            <Icon name="plus" />
            Agregar
          </button>
        </form>
      )}
    </div>
  );
}
type DropTarget = { optionId: string | null; beforeId: string | null };
/** Dónde caería la tarjeta.
 *
 *  El hueco desplaza a las vecinas, así que cambia lo que hay bajo el cursor.
 *  Si además cambiara el destino, el hueco se movería, el layout volvería atrás
 *  y el resultado parpadearía. Por eso el cursor sobre el hueco significa "ya
 *  estás en el destino" y conserva el actual: ahí se corta el ciclo. */
function dropTargetAt(
  x: number,
  y: number,
  dragged: HTMLElement | null,
  current: DropTarget | null,
): DropTarget | null {
  const target = document
    .elementsFromPoint(x, y)
    .find(
      (element) =>
        !dragged?.contains(element) && element.closest("[data-option]"),
    );
  if (target?.closest(".drop-slot")) return current;
  const column = target?.closest<HTMLElement>("[data-option]");
  if (!column) return null;
  return {
    optionId: column.dataset.option || null,
    beforeId:
      target?.closest<HTMLElement>("[data-card-id]")?.dataset.cardId ?? null,
  };
}
const CardTile = memo(function CardTile({
  card,
  fields,
  profiles,
  open,
  update,
  preview,
}: {
  card: Card;
  fields: Field[];
  profiles: Profile[];
  open(id: string): void;
  update: Update;
  preview(drop: (DropTarget & { height: number }) | null): void;
}) {
  const node = useRef<HTMLElement>(null);
  const gesture = useRef<{
    x: number;
    y: number;
    active: boolean;
    timer?: ReturnType<typeof setTimeout>;
    moved: boolean;
    touch: boolean;
    height?: number;
    drop?: DropTarget | null;
  } | null>(null);
  const prefetch = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const priority = fields.find((field) => field.id === "priority");
  const assignees = card.values.assignees;
  function start(event: React.PointerEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("button") || event.button !== 0)
      return;
    const state = {
      x: event.clientX,
      y: event.clientY,
      active: false,
      moved: false,
      touch: event.pointerType === "touch",
      timer: undefined as ReturnType<typeof setTimeout> | undefined,
    };
    gesture.current = state;
    if (state.touch)
      state.timer = setTimeout(() => {
        lift(event.pointerId);
        navigator.vibrate?.(15);
      }, 200);
    void queryClient.prefetchQuery(cardQuery(card.id));
  }
  /** Saca la tarjeta del flujo: su hueco desaparece y el único espacio que
   *  queda abierto es el del destino. */
  function lift(pointerId: number) {
    const state = gesture.current;
    const element = node.current;
    if (!state || !element || state.active) return;
    state.active = true;
    const rect = element.getBoundingClientRect();
    state.height = rect.height;
    element.style.position = "fixed";
    element.style.left = `${rect.left}px`;
    element.style.top = `${rect.top}px`;
    element.style.width = `${rect.width}px`;
    element.classList.add("dragging");
    element.setPointerCapture(pointerId);
  }
  /** Devuelve la tarjeta al flujo y borra la vista previa del hueco. */
  function drop(wasActive: boolean) {
    const element = node.current;
    if (element) {
      for (const property of ["position", "left", "top", "width", "transform"])
        element.style.removeProperty(property);
      element.classList.remove("dragging");
    }
    if (wasActive) preview(null);
  }
  function move(event: React.PointerEvent<HTMLElement>) {
    const state = gesture.current;
    if (!state) return;
    const dx = event.clientX - state.x,
      dy = event.clientY - state.y;
    if (Math.hypot(dx, dy) > 6) state.moved = true;
    if (!state.touch && state.moved) lift(event.pointerId);
    if (state.touch && !state.active && state.moved) clearTimeout(state.timer);
    if (state.active && node.current) {
      node.current.style.transform = `translate(${dx}px,${dy}px)`;
      const target = dropTargetAt(
        event.clientX,
        event.clientY,
        node.current,
        state.drop ?? null,
      );
      // Solo re-renderiza cuando el destino cambia, no en cada pointermove.
      if (
        target?.optionId !== state.drop?.optionId ||
        target?.beforeId !== state.drop?.beforeId
      ) {
        state.drop = target;
        preview(target && { ...target, height: state.height ?? 0 });
      }
    }
  }
  function end(event: React.PointerEvent<HTMLElement>) {
    const state = gesture.current;
    gesture.current = null;
    if (!state) return;
    clearTimeout(state.timer);
    // Suelta en el hueco que se mostró, no en un hit-test nuevo: lo que viste
    // es lo que pasa.
    const target = state.drop ?? null;
    drop(state.active);
    if (state.active && state.moved) {
      if (target) void update("card.move", { id: card.id, ...target });
    } else if (
      state.touch &&
      Math.abs(event.clientX - state.x) > 70 &&
      Math.abs(event.clientY - state.y) < 40
    )
      void update(
        "card.week",
        { id: card.id, weekly: !card.weekly },
        { weekly: !card.weekly },
      );
    else if (!state.moved) open(card.id);
  }
  return (
    <article
      ref={node}
      className="card"
      data-card-id={card.id}
      tabIndex={0}
      role="button"
      aria-label={`Abrir ${card.title}`}
      aria-description="Alt y flechas para mover la tarjeta"
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (
          event.altKey &&
          ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
            event.key,
          )
        ) {
          event.preventDefault();
          const column = node.current?.closest<HTMLElement>("[data-option]");
          const tiles = Array.from(
            column?.querySelectorAll<HTMLElement>("[data-card-id]") ?? [],
          );
          const index = tiles.findIndex(
            (tile) => tile.dataset.cardId === card.id,
          );
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            if (event.key === "ArrowUp" && index <= 0) return;
            const beforeId =
              event.key === "ArrowUp"
                ? tiles[index - 1]?.dataset.cardId
                : tiles[index + 2]?.dataset.cardId;
            void update("card.move", {
              id: card.id,
              optionId: column?.dataset.option || null,
              beforeId: beforeId ?? null,
            });
          } else {
            const target =
              event.key === "ArrowLeft"
                ? column?.previousElementSibling
                : column?.nextElementSibling;
            if (target instanceof HTMLElement)
              void update("card.move", {
                id: card.id,
                optionId: target.dataset.option || null,
              });
          }
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open(card.id);
        }
      }}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={() => {
        const state = gesture.current;
        gesture.current = null;
        if (state) clearTimeout(state.timer);
        drop(!!state?.active);
      }}
      onPointerEnter={() => {
        prefetch.current = setTimeout(() => {
          void queryClient.prefetchQuery(cardQuery(card.id));
        }, 50);
      }}
      onPointerLeave={() => clearTimeout(prefetch.current)}
    >
      <h3 style={{ viewTransitionName: `title-${card.id}` }}>{card.title}</h3>
      <div className="card-meta">
        {typeof card.values.priority === "string" && (
          <Chip color={chipColor(card.values.priority)}>
            {
              priority?.options.find(
                (option) => option.id === card.values.priority,
              )?.label
            }
          </Chip>
        )}
        <span className="avatars">
          {Array.isArray(assignees) &&
            assignees.map((id) => {
              const profile = profiles.find((profile) => profile.id === id);
              return (
                <span className="avatar" key={id} title={profile?.name}>
                  {profile?.name.slice(0, 1)}
                </span>
              );
            })}
        </span>
        {card.weekly && <span className="chip chip-week">Esta semana</span>}
      </div>
    </article>
  );
});

function PropertyInput({
  field,
  current,
  profiles,
  save,
}: {
  field: Field;
  current: Value | undefined;
  profiles: Profile[];
  save(value: Value): void;
}) {
  if (
    field.type === "select" ||
    field.type === "multiSelect" ||
    field.type === "people"
  ) {
    const multiple = field.type !== "select";
    return (
      <DropdownSelect
        label={field.name}
        multiple={multiple}
        clearable={!multiple}
        value={
          multiple
            ? Array.isArray(current)
              ? current
              : []
            : typeof current === "string"
              ? current
              : ""
        }
        options={
          field.type === "people"
            ? profiles.map((profile) => ({
                id: profile.id,
                label: profile.name,
              }))
            : field.options
        }
        onChange={(next) => save(next === "" ? null : next)}
      />
    );
  }
  return (
    <input
      key={JSON.stringify(current)}
      aria-label={field.name}
      type={
        field.type === "number"
          ? "number"
          : field.type === "date"
            ? "date"
            : "text"
      }
      defaultValue={
        typeof current === "number" || typeof current === "string"
          ? current
          : ""
      }
      onBlur={(event) => {
        const text = event.target.value;
        const next =
          text === "" ? null : field.type === "number" ? Number(text) : text;
        if (next !== current) save(next);
      }}
    />
  );
}
function CardDialog({
  card,
  fields,
  profiles,
  close,
  update,
  onError,
}: {
  card: Card;
  fields: Field[];
  profiles: Profile[];
  close(): void;
  update: Update;
  onError(message: string): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const confirm = useConfirm();
  const [title, setTitle] = useState(card.title);
  const [weekly, setWeekly] = useState(card.weekly);
  const [documentPending, setDocumentPending] = useState(false);
  function requestClose() {
    if (documentPending || title !== card.title) {
      onError(
        "Hay cambios sin guardar. Espera a que se guarden o reintenta antes de cerrar.",
      );
      return;
    }
    close();
  }
  useEffect(() => setWeekly(card.weekly), [card.weekly]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    dialog.current?.showModal();
    return () => previous?.focus();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-label="Detalle de tarjeta"
      className="card-dialog drawer"
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
    >
      <header className="dialog-header">
        <button
          className="dialog-close"
          onClick={requestClose}
          aria-label="Cerrar tarjeta"
        >
          »
        </button>
        <input
          className="card-title"
          aria-label="Título"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => {
            if (title !== card.title)
              void update("card.update", {
                id: card.id,
                version: card.version,
                title,
              });
          }}
        />
        <button
          onClick={async () => {
            const archiving = !card.archived;
            if (
              archiving &&
              !(await confirm({
                title: "¿Archivar esta tarjeta?",
                message: "Sale del tablero. Puedes restaurarla desde Archivadas.",
                confirmLabel: "Archivar",
              }))
            )
              return;
            void update(
              "card.archive",
              { id: card.id, archived: archiving },
              { archived: archiving },
            );
          }}
        >
          <Icon name={card.archived ? "restore" : "archive"} />
          {card.archived ? "Restaurar" : "Archivar"}
        </button>
      </header>
      <div className="property-row">
        <span>Planificación</span>
        <button
          className={weekly ? "chip week-mark marked" : "chip week-mark"}
          aria-label="Esta semana"
          aria-pressed={weekly}
          onClick={() => {
            const next = !weekly;
            setWeekly(next);
            void update(
              "card.week",
              { id: card.id, weekly: next },
              { weekly: next },
            );
          }}
        >
          Esta semana
        </button>
      </div>
      {fields.map((field) => (
        <div className="property-row" key={field.id}>
          <span>{field.name}</span>
          <PropertyInput
            field={field}
            current={card.values[field.id]}
            profiles={profiles}
            save={(value) => {
              void update("card.update", {
                id: card.id,
                version: card.version,
                values: { [field.id]: value },
              });
            }}
          />
        </div>
      ))}
      {card.bodyMissing && (
        <p className="help">
          El export de Notion no incluye el cuerpo de esta tarjeta.
        </p>
      )}
      <Suspense fallback={<p>Cargando editor…</p>}>
        <DocumentEditor
          card={card}
          onError={onError}
          onPendingChange={setDocumentPending}
        />
      </Suspense>
    </dialog>
  );
}
const rootRoute = createRootRoute({ component: Shell });
type BoardSearch = {
  view?: string;
  card?: string;
  settings?: boolean;
  invite?: string;
};
const boardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: (search: Record<string, unknown>): BoardSearch => ({
    view: ["week", "all", "archived"].includes(String(search.view))
      ? String(search.view)
      : "week",
    card: typeof search.card === "string" ? search.card : undefined,
    settings: search.settings === true || search.settings === "true",
    invite: typeof search.invite === "string" ? search.invite : undefined,
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
