import "./Settings.css";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Actor } from "@/backend/core/actions";
import { action, errorMessage, refresh, type BoardData } from "@/frontend/lib/api";
import {
  Button,
  DropdownSelect,
  Icon,
  PanelDialog,
  SettingRow,
  Toast,
  type PanelSection,
} from "@/frontend/ui";
import type { Field, Key, Webhook } from "@/backend/core/model";
export default function Settings({
  actor,
  board,
  theme,
  onTheme,
  close,
  onError,
}: {
  actor: Actor;
  board?: BoardData;
  theme: "light" | "dark" | "system";
  onTheme(theme: "light" | "dark" | "system"): void;
  close(): void;
  onError(message: string): void;
}) {
  const [result, setResult] = useState<{ note: string; value: string } | null>(
    null,
  );
  const [notice, setNotice] = useState("");
  function copy(value: string) {
    navigator.clipboard.writeText(value).then(
      () => {
        setNotice("Copiado al portapapeles");
        setTimeout(() => setNotice(""), 2000);
      },
      () => onError("No se pudo copiar. Selecciona el texto y cópialo a mano."),
    );
  }
  const keys = useQuery({
    queryKey: ["settings", "keys"],
    queryFn: () => action<Omit<Key, "digest">[]>("key.list"),
  });
  const hooks = useQuery({
    queryKey: ["settings", "hooks"],
    queryFn: () => action<Omit<Webhook, "secret">[]>("webhook.list"),
    enabled: actor.role === "admin",
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
  const sections: PanelSection[] = [
    { id: "general", label: "General" },
    { id: "keys", label: "Agentes y API keys" },
    ...(actor.role === "admin"
      ? [
          { id: "people", label: "Usuarios" },
          { id: "hooks", label: "Webhooks" },
        ]
      : []),
  ];
  return (
    <PanelDialog title="Configuración" sections={sections} onClose={close}>
      {(active) => (
        <>
          {active === "general" && (
            <section>
              <h3>General</h3>
              <SettingRow>
                <span>Apariencia</span>
                <DropdownSelect
                  label="Apariencia"
                  variant="plain"
                  value={theme}
                  onChange={(value) =>
                    onTheme(value as "light" | "dark" | "system")
                  }
                  options={[
                    { id: "system", label: "Sistema" },
                    { id: "light", label: "Claro" },
                    { id: "dark", label: "Oscuro" },
                  ]}
                />
              </SettingRow>
            </section>
          )}
          {active === "keys" && (
            <section>
              <h3>Mis agentes y API keys</h3>
              <p>
                Cada clave actúa con tus permisos. La auditoría registra al
                agente y a ti.
              </p>
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  const response = await perform("key.create", {
                    name: new FormData(event.currentTarget).get("name"),
                  });
                  if (response)
                    setResult({
                      note: "Guarda esta clave: solo se muestra ahora.",
                      value: String(response.token),
                    });
                }}
              >
                <label>
                  Nombre del agente
                  <input name="name" required />
                </label>
                <button>Crear clave</button>
              </form>
              {keys.data?.map((key) => (
                <SettingRow key={key.id}>
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
                </SettingRow>
              ))}
            </section>
          )}
          {active === "people" && (
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
                    setResult({
                      note: "Enlace de invitación. Compártelo directamente.",
                      value: `${location.origin}/?invite=${response.token}`,
                    });
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
                  <SettingRow key={profile.id}>
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
                  </SettingRow>
                ))}
            </section>
          )}
          {active === "hooks" && (
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
                    setResult({
                      note: "Secreto para verificar la firma HMAC-SHA256.",
                      value: String(response.secret),
                    });
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
                <SettingRow key={hook.id}>
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
                </SettingRow>
              ))}
            </section>
          )}
          {/* Un secreto se muestra una sola vez: queda al pie de cualquier
              sección hasta que quien lo pidió lo oculte. */}
          {result && (
            <div className="secret-result">
              <p>{result.note}</p>
              <div className="secret-value">
                <code>{result.value}</code>
                <button
                  type="button"
                  aria-label="Copiar al portapapeles"
                  onClick={() => copy(result.value)}
                >
                  <Icon name="copy" />
                </button>
              </div>
              <button type="button" onClick={() => setResult(null)}>
                Ocultar
              </button>
            </div>
          )}
          {notice && <Toast message={notice} onDismiss={() => setNotice("")} />}
        </>
      )}
    </PanelDialog>
  );
}
