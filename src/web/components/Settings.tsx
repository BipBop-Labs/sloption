import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Actor, ActionEvent } from "../../core/actions";
import { action, errorMessage, refresh, type BoardData } from "../api";
import { Button, DropdownSelect, Modal } from "../ui";
import type { Field, Key, Webhook } from "../../core/model";
export default function Settings({
  actor,
  board,
  close,
  onError,
}: {
  actor: Actor;
  board?: BoardData;
  close(): void;
  onError(message: string): void;
}) {
  const [result, setResult] = useState("");
  const [before, setBefore] = useState<number>();
  const keys = useQuery({
    queryKey: ["settings", "keys"],
    queryFn: () => action<Omit<Key, "digest">[]>("key.list"),
  });
  const hooks = useQuery({
    queryKey: ["settings", "hooks"],
    queryFn: () => action<Omit<Webhook, "secret">[]>("webhook.list"),
    enabled: actor.role === "admin",
  });
  const history = useQuery({
    queryKey: ["settings", "history", before],
    queryFn: () =>
      action<(ActionEvent & { sequence: number })[]>("history.list", {
        before,
        limit: 30,
      }),
  });
  const catalog = useQuery({
    queryKey: ["settings", "catalog"],
    queryFn: () => action<{ name: string; event: string }[]>("catalog.read"),
  });
  async function perform(name: string, input: unknown) {
    try {
      const response = await action<Record<string, unknown>>(name, input);
      refresh();
      return response;
    } catch (error) {
      onError(errorMessage(error));
      return null;
    }
  }
  return (
    <Modal className="settings-dialog" onClose={close}>
      <header className="dialog-header">
        <h2>Configuración</h2>
        <button
          className="dialog-close"
          onClick={close}
          aria-label="Cerrar configuración"
        >
          ×
        </button>
      </header>
      <section>
        <h3>Mis agentes y API keys</h3>
        <p>
          Cada clave actúa con tus permisos. La auditoría registra al agente y a
          ti.
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const response = await perform("key.create", {
              name: new FormData(event.currentTarget).get("name"),
            });
            if (response)
              setResult(
                `Guarda esta clave: solo se muestra ahora.\n${response.token}`,
              );
          }}
        >
          <label>
            Nombre del agente
            <input name="name" required />
          </label>
          <button>Crear clave</button>
        </form>
        {keys.data?.map((key) => (
          <div className="setting-row" key={key.id}>
            <span>
              {key.name} · {key.revoked ? "Revocada" : "Activa"}
            </span>
            {!key.revoked && (
              <Button
                variant="danger"
                onClick={() => {
                  void perform("key.revoke", { id: key.id });
                }}
              >
                Revocar
              </Button>
            )}
          </div>
        ))}
      </section>
      {result && (
        <div className="secret-result">
          <p>Resultado</p>
          <textarea
            readOnly
            value={result}
            aria-label="Resultado de la operación"
          />
          <button onClick={() => setResult("")}>Ocultar</button>
        </div>
      )}
      {actor.role === "admin" && (
        <>
          <section>
            <h3>Usuarios e invitaciones</h3>
            <p>Comparte el enlace directamente. No se envía correo.</p>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                const response = await perform("invitation.create", {
                  email: data.get("email"),
                  profileId: data.get("profile") || null,
                  role: data.get("role"),
                });
                if (response)
                  setResult(`${location.origin}/?invite=${response.token}`);
              }}
            >
              <label>
                Correo
                <input name="email" type="email" required />
              </label>
              <label>
                Vincular identidad
                <DropdownSelect
                  label="Vincular identidad"
                  name="profile"
                  clearable
                  placeholder="Crear una persona nueva"
                  options={
                    board?.profiles
                      .filter(
                        (profile) =>
                          !profile.authUserId && profile.kind === "person",
                      )
                      .map((profile) => ({
                        id: profile.id,
                        label: profile.name,
                      })) ?? []
                  }
                />
              </label>
              <label>
                Rol
                <DropdownSelect
                  label="Rol de la invitación"
                  name="role"
                  defaultValue="member"
                  options={[
                    { id: "member", label: "Miembro" },
                    { id: "admin", label: "Administrador" },
                  ]}
                />
              </label>
              <button>Crear invitación</button>
            </form>
            {board?.profiles
              .filter((profile) => profile.kind === "person")
              .map((profile) => (
                <div className="setting-row" key={profile.id}>
                  <span>
                    {profile.name} ·{" "}
                    {profile.authUserId ? "Con acceso" : "Sin acceso"}
                  </span>
                  <DropdownSelect
                    label={`Rol de ${profile.name}`}
                    value={profile.role}
                    onChange={(value) => {
                      void perform("profile.update", {
                        id: profile.id,
                        role: value,
                      });
                    }}
                    options={[
                      { id: "member", label: "Miembro" },
                      { id: "admin", label: "Administrador" },
                    ]}
                  />
                </div>
              ))}
          </section>
          <section>
            <h3>Propiedades y columnas</h3>
            <label>
              Agrupar tablero por
              <DropdownSelect
                label="Agrupar tablero por"
                value={board?.board.groupingId}
                onChange={(value) => {
                  void perform("board.configure", { groupingId: value });
                }}
                options={
                  board?.fields
                    .filter((field) => field.type === "select")
                    .map((field) => ({ id: field.id, label: field.name })) ?? []
                }
              />
            </label>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const data = new FormData(form);
                if (
                  await perform("field.create", {
                    name: data.get("name"),
                    type: data.get("type"),
                    options: [],
                  })
                )
                  form.reset();
              }}
            >
              <label>
                Nombre
                <input name="name" required />
              </label>
              <label>
                Tipo
                <DropdownSelect
                  label="Tipo de propiedad"
                  name="type"
                  defaultValue="text"
                  options={[
                    { id: "text", label: "Texto" },
                    { id: "number", label: "Número" },
                    { id: "date", label: "Fecha" },
                    { id: "select", label: "Selección" },
                    { id: "multiSelect", label: "Selección múltiple" },
                  ]}
                />
              </label>
              <button>Crear propiedad</button>
            </form>
            {board?.fields.map((field) => (
              <FieldSettings
                key={`${field.id}-${JSON.stringify(field.options)}`}
                field={field}
                perform={perform}
                grouping={board.board.groupingId}
              />
            ))}
          </section>
          <section>
            <h3>Webhooks</h3>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                const response = await perform("webhook.create", {
                  url: data.get("url"),
                  events: data.getAll("events"),
                  enabled: true,
                });
                if (response)
                  setResult(
                    `Secreto para verificar la firma HMAC-SHA256:\n${response.secret}`,
                  );
              }}
            >
              <label>
                URL de destino
                <input type="url" name="url" required />
              </label>
              <label>
                Eventos
                <DropdownSelect
                  label="Eventos del webhook"
                  name="events"
                  multiple
                  options={
                    catalog.data?.map((item) => ({
                      id: item.event,
                      label: item.name,
                    })) ?? []
                  }
                />
              </label>
              <button>Crear webhook</button>
            </form>
            {hooks.data?.map((hook) => (
              <div className="setting-row" key={hook.id}>
                <span>{hook.url}</span>
                <button
                  onClick={() => {
                    void perform("webhook.update", {
                      ...hook,
                      enabled: !hook.enabled,
                    });
                  }}
                >
                  {hook.enabled ? "Pausar" : "Activar"}
                </button>
                <Button
                  variant="danger"
                  onClick={() => {
                    void perform("webhook.remove", { id: hook.id });
                  }}
                >
                  Eliminar
                </Button>
              </div>
            ))}
          </section>
        </>
      )}
      <section>
        <h3>Historial</h3>
        {history.data?.map((event) => (
          <div className="history-entry" key={event.id}>
            <time>{new Date(event.occurredAt).toLocaleString("es-CL")}</time>
            <span>{event.type}</span>
            <span>
              {board?.profiles.find(
                (profile) => profile.id === event.actor.userId,
              )?.name ?? event.actor.userId}
              {event.actor.agentId &&
                ` / ${board?.profiles.find((profile) => profile.id === event.actor.agentId)?.name ?? "Agente"}`}
            </span>
          </div>
        ))}
        <button
          onClick={() => setBefore(history.data?.at(-1)?.sequence)}
          disabled={!history.data?.length}
        >
          Anteriores
        </button>
        <button onClick={() => setBefore(undefined)}>Más recientes</button>
      </section>
    </Modal>
  );
}
function FieldSettings({
  field,
  perform,
  grouping,
}: {
  field: Field;
  perform(name: string, input: unknown): Promise<unknown>;
  grouping: string;
}) {
  const [name, setName] = useState(field.name);
  const [options, setOptions] = useState(field.options);
  const [newOption, setNewOption] = useState("");
  return (
    <details className="field-settings">
      <summary>{field.name}</summary>
      <label>
        Nombre
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      {options.map((option, index) => (
        <div className="setting-row" key={option.id}>
          <input
            aria-label={`Opción ${index + 1}`}
            value={option.label}
            onChange={(event) =>
              setOptions((items) =>
                items.map((item) =>
                  item.id === option.id
                    ? { ...item, label: event.target.value }
                    : item,
                ),
              )
            }
          />
          <button
            aria-label={`Subir ${option.label}`}
            disabled={index === 0}
            onClick={() =>
              setOptions((items) => {
                const copy = [...items];
                [copy[index - 1], copy[index]] = [
                  copy[index]!,
                  copy[index - 1]!,
                ];
                return copy;
              })
            }
          >
            ↑
          </button>
          <Button
            aria-label={`Eliminar opción ${option.label}`}
            variant="danger"
            onClick={() =>
              setOptions((items) =>
                items.filter((item) => item.id !== option.id),
              )
            }
          >
            ×
          </Button>
        </div>
      ))}
      {(field.type === "select" || field.type === "multiSelect") && (
        <div className="setting-row">
          <input
            aria-label={`Nueva opción de ${field.name}`}
            value={newOption}
            onChange={(event) => setNewOption(event.target.value)}
            placeholder="Nueva opción"
          />
          <button
            onClick={() => {
              if (newOption.trim()) {
                setOptions((items) => [
                  ...items,
                  { id: crypto.randomUUID(), label: newOption.trim() },
                ]);
                setNewOption("");
              }
            }}
          >
            Agregar
          </button>
        </div>
      )}
      <p className="help">
        Eliminar una opción limpia ese valor en las tarjetas.
      </p>
      <button
        onClick={() => {
          void perform("field.update", { id: field.id, name, options });
        }}
      >
        Guardar propiedad
      </button>
      <Button
        disabled={grouping === field.id}
        variant="danger"
        onClick={() => {
          void perform("field.remove", { id: field.id });
        }}
      >
        Eliminar propiedad
      </Button>
    </details>
  );
}
