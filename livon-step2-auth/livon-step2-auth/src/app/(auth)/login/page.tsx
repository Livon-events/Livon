import Link from "next/link";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="auth-scope">
      <div className="grid-field" aria-hidden="true" />

      <main className="stage">
        <section className="pass" aria-labelledby="form-title">
          <div className="pass-notch">
            <div className="logo-placeholder" aria-label="Livon logo placeholder">
              <span>LOGO</span>
            </div>
          </div>

          <header className="pass-head">
            <p className="eyebrow">Welcome back</p>
            <h1 id="form-title">Sign in</h1>
          </header>

          <GoogleSignInButton />

          <div className="divider">
            <span>or use your email</span>
          </div>

          <LoginForm />

          <p className="switch-line">
            New to Livon? <Link href="/signup">Create an account</Link>
          </p>
        </section>
      </main>
    </div>
  );
}
