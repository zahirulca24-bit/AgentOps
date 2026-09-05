import React from 'react';
import { Card, CardContent, Badge } from '@/components/ui';
import type { LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';

export interface PlaceholderPageProps {
  title: string;
  description: string;
  promptNote?: string;
  icon?: LucideIcon;
}

export function PlaceholderPage({
  title,
  description,
  promptNote = 'This workspace will be implemented in a later frontend prompt.',
  icon: Icon,
}: PlaceholderPageProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Page Header */}
      <div className="border-b border-border pb-5">
        <div className="flex items-center gap-3">
          {Icon && (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring" }}
              className="w-10 h-10 rounded-lg bg-surface-muted border border-border flex items-center justify-center text-primary shrink-0"
            >
              <Icon className="w-5 h-5" />
            </motion.div>
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              {description}
            </p>
          </div>
        </div>
      </div>

      {/* Planned Workspace Notice */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
      >
        <Card className="border-dashed border-border bg-surface/50">
          <CardContent className="py-12 px-6 flex flex-col items-center text-center max-w-md mx-auto space-y-4">
            <Badge variant="outline" size="sm">
              Phase 1 Placeholder
            </Badge>

            <div className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                Workspace Inactive
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {promptNote}
              </p>
            </div>

            <div className="pt-2 text-[11px] font-mono text-muted-foreground">
              Navigation route verified • Ready for subsequent module implementation
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
