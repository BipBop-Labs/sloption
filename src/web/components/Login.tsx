import { useState } from "react";
import { errorMessage, request } from "../api";
import { Button } from "../ui";

export function Login({ invite, onDone }: { invite?: string; onDone(): void }) {
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
        <Button variant="primary" disabled={busy}>
          {invite ? "Aceptar invitación" : "Entrar"}
        </Button>
      </form>
      {!invite && (
        <p className="help">
          El acceso es por invitación. Pídele un enlace a un administrador.
        </p>
      )}
    </main>
  );
}
