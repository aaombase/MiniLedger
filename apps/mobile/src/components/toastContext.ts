import { createContext } from "react";

// Separate module so hot reloads of ToastProvider.tsx keep the same context.
export type ToastTone = "success" | "error" | "info";
export interface ToastMsg { message: string; tone?: ToastTone }
export interface ToastCtx { show(t: ToastMsg): void }
export const ToastContext = createContext<ToastCtx | null>(null);
