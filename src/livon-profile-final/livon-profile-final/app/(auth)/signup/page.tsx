import Link from "next/link";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { SignupForm } from "@/components/auth/SignupForm";

type SignupPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { next } = await searchParams;

  return (
    <div className="auth-scope signup-page">
      <div className="grid-field" aria-hidden="true" />

      <main className="stage">
        <section className="pass" aria-labelledby="form-title">
          <div className="pass-notch">
            <div className="logo-placeholder" aria-label="Livon logo placeholder">
              <span>LOGO</span>
            </div>
          </div>

          <header className="pass-head">
            <p className="eyebrow">Get in</p>
            <h1 id="form-title">Create your account</h1>
          </header>

          <GoogleSignInButton />

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
