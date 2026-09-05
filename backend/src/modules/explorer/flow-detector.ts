import type { PageObservation, FlowCandidate } from './explorer.schema.js';

export class FlowDetector {
  public detectFlows(observation: PageObservation): FlowCandidate[] {
    const candidates: FlowCandidate[] = [];

    for (const form of observation.forms) {
      const inputs = form.inputs;
      
      const hasPassword = inputs.some(i => i.inputType === 'password');
      const hasEmail = inputs.some(i => i.inputType === 'email' || (i.name && i.name.toLowerCase().includes('email')));
      const hasName = inputs.some(i => i.name && i.name.toLowerCase().includes('name'));

      if (hasPassword && hasEmail && !hasName) {
        candidates.push({
          type: 'login',
          confidence: 0.9,
          elements: form.inputs.concat(form.buttons),
        });
      } else if (hasPassword && hasEmail && hasName) {
        candidates.push({
          type: 'signup',
          confidence: 0.8,
          elements: form.inputs.concat(form.buttons),
        });
      }
      
      const hasSearch = inputs.some(i => i.inputType === 'search' || (i.name && i.name.toLowerCase().includes('search')));
      if (hasSearch && !hasPassword) {
        candidates.push({
          type: 'search',
          confidence: 0.8,
          elements: form.inputs.concat(form.buttons),
        });
      }
    }

    return candidates;
  }
}
