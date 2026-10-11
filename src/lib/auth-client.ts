"use client";

import { createAuthClient } from "@neondatabase/auth/next";

export const authClient = createAuthClient();

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  emailVerified?: boolean;
}

/**
 * Sign up with email, password, and optional full name.
 */
export async function signUpWithEmail(params: {
  email: string;
  password: string;
  name?: string;
}) {
  return authClient.signUp.email({
    email: params.email.trim().toLowerCase(),
    password: params.password,
    name: params.name?.trim() || "",
  });
}

/**
 * Sign in with email and password.
 */
export async function signInWithEmail(params: {
  email: string;
  password: string;
}) {
  return authClient.signIn.email({
    email: params.email.trim().toLowerCase(),
    password: params.password,
  });
}


/**
 * Request password recovery email.
 */
export async function sendPasswordResetEmail(params: {
  email: string;
  redirectTo?: string;
}) {
  const anyClient = authClient as unknown as {
    forgetPassword: (opts: { email: string; redirectTo?: string }) => Promise<{
      data: unknown;
      error: { message?: string } | null;
    }>;
  };
  return anyClient.forgetPassword({
    email: params.email.trim().toLowerCase(),
    redirectTo: params.redirectTo || "/reset-password",
  });
}

/**
 * Reset password with recovery token.
 */
export async function resetPasswordWithToken(params: {
  newPassword: string;
  token: string;
}) {
  const anyClient = authClient as unknown as {
    resetPassword: (opts: { newPassword: string; token: string }) => Promise<{
      data: unknown;
      error: { message?: string } | null;
    }>;
  };
  return anyClient.resetPassword({
    newPassword: params.newPassword,
    token: params.token,
  });
}

/**
 * Sign out current session and clear local state.
 */
export async function signOutUser() {
  return authClient.signOut();
}
