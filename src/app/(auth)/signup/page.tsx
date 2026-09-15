import { redirect } from "next/navigation";
import { safeInternalPath } from "@/shared/security/urls";

type SignupPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { next } = await searchParams;
  const destination = safeInternalPath(next, "");
  const dest = destination ? `/login?next=${encodeURIComponent(destination)}` : "/login";
  redirect(dest);
}
