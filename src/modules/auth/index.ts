export { signInWithGoogle, signOut } from "./mutations";
export { GoogleSignInButton } from "./components/GoogleSignInButton";
export { SignOutButton } from "./components/SignOutButton";

// Server-only — not re-exported here. `exchangeOAuthCode` uses the server
// Supabase client (cookie-bound); only `app/auth/callback/route.ts` should
// import it directly:
//   import { exchangeOAuthCode } from "@/modules/auth/serverMutations";
