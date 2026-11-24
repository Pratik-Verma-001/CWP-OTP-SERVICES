export const authError = (e: any) => {
  const code: string = e?.code ?? "unknown";
  const msg: Record<string, string> = {
    "auth/invalid-credential": "Wrong email or password.", "auth/wrong-password": "Wrong email or password.",
    "auth/user-not-found": "No account with this email.", "auth/invalid-email": "Email format is invalid.",
    "auth/email-already-in-use": "An account with this email already exists. Sign in instead.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/invalid-api-key": "Firebase config is missing or wrong. Check the NEXT_PUBLIC_FIREBASE_* variables, then redeploy.",
    "auth/operation-not-allowed": "Email/Password sign-in is not enabled in Firebase Authentication.",
    "auth/user-disabled": "This account is disabled.", "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
    "auth/network-request-failed": "Network error. Check your connection.",
  };
  return (msg[code] ?? "Something went wrong.") + ` (${code})`;
};
