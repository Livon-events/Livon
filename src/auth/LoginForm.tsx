"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmail } from "@/lib/mutations/auth";

export function LoginForm() {
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

    router.push("/profile");
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

      <div className="field">
        <div className="field-label-row">
          <label htmlFor="password">Password</label>
          <a href="#" className="forgot-link">
            Forgot password?
          </a>
        </div>
        <input
          type="password"
          id="password"
          name="password"
          placeholder="••••••••"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <button type="submit" className="submit-btn" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
