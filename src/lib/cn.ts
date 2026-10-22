import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combina clases Tailwind sin conflictos (patrón del design system). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
