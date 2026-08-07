import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/shared/supabase/server";
import { GoogleSignInButton } from "@/modules/auth";
import { LoginForm } from "@/modules/auth";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

function safeNext(next: string | undefined): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return "/profile";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(safeNext(next));
  }

  return (
    <div className="auth-scope">
      <div className="grid-field" aria-hidden="true" />

      <main className="stage">
        <section className="pass" aria-labelledby="form-title">
          <div className="pass-notch">
            <div className="logo-placeholder" aria-label="Livon logo placeholder">
              <span>Livon</span>
            </div>
          </div>

          <header className="pass-head">
            <h1 id="form-title">Sign in</h1>
          </header>

          <GoogleSignInButton next={next} />

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