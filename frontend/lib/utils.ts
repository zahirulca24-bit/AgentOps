/**
 * Utility functions for AgentOps frontend
 */

/**
 * Cleanly merges CSS class names, filtering out falsey values.
 */
export function cn(...classes: Array<string | number | boolean | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
