import { describe, expect, it } from 'vitest'; import { SETTINGS_TABS } from './settings-workspace';
describe('Settings sections', () => { it('keeps settings focused on three operational sections', () => expect(SETTINGS_TABS).toEqual(['General', 'Integrations', 'Security'])); });
