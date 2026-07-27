"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmail } from "@/modules/auth/mutations";
import { PasswordField } from "@/modules/auth/components/PasswordField";

// Only ever redirect to a same-site path — never follow an absolute or
// protocol-relative URL from the `next` param, to avoid open-redirect abuse.
function safeNext(next: string | undefined): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return "/profile";
}

interface LoginFormProps {
  next?: string;
}

export function LoginForm({ next }: LoginFormProps) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!identifier || !password) {
      setError("Enter your username or email and password.");
      return;
    }

    setPending(true);
    const result = await signInWithEmail({ identifier, password });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.push(safeNext(next));
    router.refresh();
  }

  return (
    <form className="pass-form" noValidate onSubmit={handleSubmit}>
      {error && <p className="form-error">{error}</p>}

      <div className="field">
        <label htmlFor="identifier">Username or email</label>
        <input
          type="text"
          id="identifier"
          name="identifier"
          placeholder="thabo_m or you@limkokwing.ac.ls"
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
      </div>

      <PasswordField
        id="password"
        name="password"
        label="Password"
        placeholder="••••••••"
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
        labelRightSlot={
          <a href="#" className="forgot-link">
            Forgot password?
          </a>
        }
      />

      <button type="submit" className="submit-btn" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
