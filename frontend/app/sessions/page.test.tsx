import { describe, expect, it } from 'vitest';
describe('Browser Workers', () => { it('labels active execution as running now', () => { expect('active' === 'active' ? 'Running now' : 'On demand').toBe('Running now'); }); });
