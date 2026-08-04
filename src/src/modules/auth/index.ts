export { signUpWithEmail, signInWithEmail, signInWithGoogle, signOut } from "./mutations";
export { GoogleSignInButton } from "./components/GoogleSignInButton";
export { LoginForm } from "./components/LoginForm";
export { PasswordField } from "./components/PasswordField";
export { SignOutButton } from "./components/SignOutButton";
export { SignupForm } from "./components/SignupForm";

// Server-only — not re-exported here. `exchangeOAuthCode` uses the server
// Supabase client (cookie-bound); only `app/auth/callback/route.ts` should
// import it directly:
//   import { exchangeOAuthCode } from "@/modules/auth/serverMutations";
