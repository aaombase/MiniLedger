import { createContext } from "react";
import type { User } from "@/shared/types";

// Context lives in its own module so hot reloads of AuthProvider.tsx don't create a second context.
export type AuthStatus = "loading" | "signedOut" | "signedIn";
export interface AuthCtx {
  status: AuthStatus;
  user: User | null;
  signIn(token: string, user: User): Promise<void>;
  signOut(): Promise<void>;
}
export const AuthContext = createContext<AuthCtx | null>(null);
