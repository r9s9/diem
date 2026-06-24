import { clsx, type ClassValue } from "clsx";

/** Tiny className combiner. */
export function cn(...args: ClassValue[]): string {
  return clsx(args);
}
