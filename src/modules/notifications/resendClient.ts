import "server-only";
import { Resend } from "resend";

export function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY.");
  }
  return new Resend(apiKey);
}

export function getFromEmail(): string {
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!from) {
    throw new Error("Missing RESEND_FROM_EMAIL.");
  }
  return from;
}
