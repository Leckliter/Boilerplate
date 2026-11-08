import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes, letting later ones win. Use in every component. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
