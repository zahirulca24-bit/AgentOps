import React from 'react';
import { Card, CardContent, Button } from '@/components/ui';
import { Link } from '@/lib/router';
import { Terminal, Sparkles, CheckCircle, ArrowRight, Bot, ShieldCheck } from 'lucide-react';

export function DashboardEmptyState() {
  return (
    <Card className="border-dashed border-border bg-surface/50 overflow-hidden">
      <CardContent className="p-8 sm:p-12 max-w-2xl mx-auto text-center flex flex-col items-center space-y-6">
        {/* Visual Icon Badge */}
        <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
          <Bot className="w-7 h-7" />
        </div>

        {/* Heading & Subtitle */}
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Run your first QA test
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-lg mx-auto">
            AgentOps is deployed and standing by. Dispatch autonomous browser agents to test your staging workflows, verify critical user paths, or reproduce regression bugs.
          </p>
        </div>

        {/* Action Button leading to /command */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
          <Link href="/command">
            <Button
              variant="primary"
              size="lg"
              leftIcon={<Terminal className="w-4 h-4" />}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Open Command Center
            </Button>
          </Link>
        </div>

        {/* 3 Quick Capabilities of Fresh Install */}
        <div className="pt-6 border-t border-border/80 w-full grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
          <div className="p-3 rounded-md bg-surface-muted/60 border border-border text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Natural Prompts</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Describe test scenarios in plain English; agents generate steps.
            </p>
          </div>

          <div className="p-3 rounded-md bg-surface-muted/60 border border-border text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Headless Chrome</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Autonomous execution in clean containerized browser instances.
            </p>
          </div>

          <div className="p-3 rounded-md bg-surface-muted/60 border border-border text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <CheckCircle className="w-3.5 h-3.5 text-sky-500 shrink-0" />
              <span>Automatic Triage</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Instant DOM trace extraction and bug severity classification.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
