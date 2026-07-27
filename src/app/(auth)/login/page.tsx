import Link from "next/link";
import { GoogleSignInButton } from "@/modules/auth";
import { LoginForm } from "@/modules/auth";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;

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

          <LoginForm next={next} />

          <p className="switch-line">
            New to Livon?{" "}
            <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}>
              Create an account
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}