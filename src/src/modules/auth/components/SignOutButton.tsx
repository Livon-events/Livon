"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/modules/auth/mutations";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    await signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="mt-8 w-full rounded-xl bg-[#E5342E] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#cc2b26] disabled:opacity-60"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}