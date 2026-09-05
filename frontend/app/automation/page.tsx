'use client';

import React from 'react';
import { AutomationCanvas, AutomationHeader } from '@/components/automation';
import { MOCK_WORKFLOW } from '@/lib/mock-automation';
import { motion, useReducedMotion } from 'motion/react';

export default function AutomationPage() {
  const reduceMotion = useReducedMotion();

  return (
    <div id="agentops-automation-page" className="flex h-full flex-col space-y-4">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.3 }}
        className="flex-shrink-0"
      >
        <AutomationHeader workflow={MOCK_WORKFLOW} />
      </motion.div>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.3, delay: 0.1 }}
        className="min-h-[420px] flex-1 sm:min-h-[500px]"
      >
        <AutomationCanvas initialWorkflow={MOCK_WORKFLOW} />
      </motion.div>
    </div>
  );
}
