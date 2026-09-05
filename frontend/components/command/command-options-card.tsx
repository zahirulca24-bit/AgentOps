import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button } from '@/components/ui';
import { QA_OPTIONS_CONFIG, DEFAULT_QA_OPTIONS } from '@/lib/command-presets';
import { QAOptionKey, QAOptionsState } from '@/types';
import {
  Compass,
  CheckSquare,
  Eye,
  Terminal,
  Activity,
  Camera,
  Check,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';

export interface CommandOptionsCardProps {
  options: QAOptionsState;
  onChange: (options: QAOptionsState) => void;
  disabled?: boolean;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } },
};

export function CommandOptionsCard({
  options,
  onChange,
  disabled = false,
}: CommandOptionsCardProps) {
  const getIcon = (key: QAOptionKey) => {
    switch (key) {
      case 'autoExplore':
        return <Compass className="w-4 h-4 text-primary" />;
      case 'functionalTests':
        return <CheckSquare className="w-4 h-4 text-emerald-500" />;
      case 'visualChecks':
        return <Eye className="w-4 h-4 text-sky-500" />;
      case 'consoleMonitoring':
        return <Terminal className="w-4 h-4 text-amber-500" />;
      case 'networkMonitoring':
        return <Activity className="w-4 h-4 text-purple-500" />;
      case 'screenshotEvidence':
        return <Camera className="w-4 h-4 text-rose-500" />;
    }
  };

  const handleToggle = (key: QAOptionKey) => {
    if (disabled) return;
    onChange({
      ...options,
      [key]: !options[key],
    });
  };

  const handleReset = () => {
    if (disabled) return;
    onChange({ ...DEFAULT_QA_OPTIONS });
  };

  const enabledCount = Object.values(options).filter(Boolean).length;

  return (
    <Card className="border-border bg-surface">
      <CardHeader className="pb-3 border-b border-border/80 flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span>QA Agent Capabilities</span>
            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-surface-muted text-muted-foreground border border-border">
              {enabledCount} of {QA_OPTIONS_CONFIG.length} enabled
            </span>
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Select automated inspection engines for this test session
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          disabled={disabled}
          className="text-xs text-muted-foreground hover:text-foreground h-7 px-2"
          leftIcon={<RotateCcw className="w-3 h-3" />}
        >
          Reset
        </Button>
      </CardHeader>
      <CardContent className="p-4 sm:p-5">
        <motion.div 
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {QA_OPTIONS_CONFIG.map((opt) => {
            const isChecked = options[opt.key];
            return (
              <motion.button
                variants={itemVariants}
                key={opt.key}
                type="button"
                role="checkbox"
                aria-checked={isChecked}
                disabled={disabled}
                onClick={() => handleToggle(opt.key)}
                className={cn(
                  'p-3 rounded-lg border text-left transition-all flex items-start gap-3 select-none',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                  isChecked
                    ? 'bg-surface border-primary/40 shadow-xs'
                    : 'bg-surface-muted/30 border-border/70 opacity-70 hover:opacity-100 hover:bg-surface-muted/60',
                  disabled && 'cursor-not-allowed opacity-50'
                )}
              >
                {/* Custom Styled Checkbox box */}
                <div
                  className={cn(
                    'w-4 h-4 rounded border mt-0.5 flex items-center justify-center shrink-0 transition-colors',
                    isChecked
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-muted-foreground/40 bg-surface'
                  )}
                  aria-hidden="true"
                >
                  {isChecked && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}><Check className="w-3 h-3 stroke-[3]" /></motion.div>}
                </div>

                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    {getIcon(opt.key)}
                    <span className="text-xs font-semibold text-foreground">
                      {opt.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    {opt.description}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </motion.div>
      </CardContent>
    </Card>
  );
}
