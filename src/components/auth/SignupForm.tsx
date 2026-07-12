"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signUpWithEmail } from "@/lib/mutations/auth";
import { PasswordField } from "@/components/auth/PasswordField";

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export function SignupForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function validate(): string | null {
    if (!USERNAME_PATTERN.test(username)) {
      return "Username must be 3–20 characters: letters, numbers, and underscores only.";
    }
    if (!email) {
      return "Enter a valid email address.";
    }
    if (password.length < 8) {
      return "Password must be at least 8 characters.";
    }
    if (password !== confirmPassword) {
      return "Passwords don't match.";
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setPending(true);
    const result = await signUpWithEmail({
      username: username.toLowerCase(),
      email,
      password,
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (result.data.needsEmailConfirmation) {
      setNotice("Account created — check your inbox to verify your email.");
      return;
    }

    router.push("/profile");
    router.refresh();
  }

  return (
    <form className="pass-form" noValidate onSubmit={handleSubmit}>
      {error && <p className="form-error">{error}</p>}
      {notice && <p className="form-notice">{notice}</p>}

      <div className="field">
        <label htmlFor="username">Username</label>
        <input
          type="text"
          id="username"
          name="username"
          placeholder="e.g. thabo_m"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
        />
      </div>

      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          type="email"
          id="email"
          name="email"
          placeholder="you@limkokwing.ac.ls"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="field-row">
        <PasswordField
          id="password"
          name="password"
          label="Password"
          placeholder="••••••••"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
        />

        <PasswordField
          id="confirm-password"
          name="confirm-password"
          label="Confirm password"
          placeholder="••••••••"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={setConfirmPassword}
        />
      </div>

      <button type="submit" className="submit-btn" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
