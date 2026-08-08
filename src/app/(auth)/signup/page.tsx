import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/shared/supabase/server";
import { GoogleSignInButton } from "@/modules/auth";
import { SignupForm } from "@/modules/auth";

type SignupPageProps = {
  searchParams: Promise<{ next?: string }>;
};

function safeNext(next: string | undefined): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return "/profile";
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { next } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(safeNext(next));
  }

  return (
    <div className="auth-scope signup-page">
      <div className="grid-field" aria-hidden="true" />

      <main className="stage">
        <section className="pass" aria-labelledby="form-title">
          <div className="pass-notch">
            <div className="logo-placeholder" aria-label="Livon logo">
              <Image src="/logo.png" alt="Livon" width={44} height={50} priority />
            </div>
          </div>

          <header className="pass-head">
            <h1 id="form-title">Create your account</h1>
          </header>

          <GoogleSignInButton next={next} />

          <div className="divider">
            <span>or use your email</span>
          </div>

          <SignupForm next={next} />

          <p className="switch-line">
            Already going places?{" "}
            <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>
              Sign in
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}