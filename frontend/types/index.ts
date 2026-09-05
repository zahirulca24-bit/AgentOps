/**
 * Core TypeScript definitions for AgentOps
 */

export interface AppMetadata {
  title: string;
  description: string;
}

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export type Theme = 'dark' | 'light';

export type StatusType = 'idle' | 'running' | 'success' | 'warning' | 'error';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral';

export * from './dashboard';
export * from './command';
export * from './session';
export * from './automation';
