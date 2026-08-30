import { redirect } from "next/navigation";

type SignupPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { next } = await searchParams;
  const dest =
    next && next.startsWith("/") && !next.startsWith("//")
      ? `/login?next=${encodeURIComponent(next)}`
      : "/login";
  redirect(dest);
}
