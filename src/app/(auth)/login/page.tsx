import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/shared/supabase/server";
import { GoogleSignInButton } from "@/modules/auth";

type LoginPageProps = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

function safeNext(next: string | undefined): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return "/profile";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next, error } = await searchParams;

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
            <div className="logo-placeholder" aria-label="Livon logo">
              <Image src="/logo.png" alt="Livon" width={44} height={50} priority />
            </div>
          </div>

          <header className="pass-head">
            <h1 id="form-title">Don’t miss what your people are going to</h1>
            <p>
              Sign in to see which events your connections are interested in,
              and get reminders before they happen.
            </p>
          </header>

          {error === "auth_callback_failed" && (
            <p className="form-error">Google sign-in didn’t complete. Try again.</p>
          )}

          <GoogleSignInButton next={next} />
        </section>
      </main>
    </div>
  );
}
