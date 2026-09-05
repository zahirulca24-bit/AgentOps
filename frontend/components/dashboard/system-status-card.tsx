import React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  StatusIndicator,
} from '@/components/ui';
import { SystemServiceStatus } from '@/types';
import { Cpu, Globe, Server, CheckCircle2, ShieldCheck } from 'lucide-react';

export interface SystemStatusCardProps {
  services: SystemServiceStatus[];
}

export function SystemStatusCard({ services }: SystemStatusCardProps) {
  const getComponentIcon = (component: SystemServiceStatus['component']) => {
    switch (component) {
      case 'agent':
        return <Cpu className="w-4 h-4 text-primary" />;
      case 'browser':
        return <Globe className="w-4 h-4 text-sky-500" />;
      case 'api':
        return <Server className="w-4 h-4 text-emerald-500" />;
    }
  };

  return (
    <Card className="border-border bg-surface">
      <CardHeader className="pb-3 border-b border-border/80 flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <CardTitle className="text-base font-semibold text-foreground">
            System Subsystems
          </CardTitle>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground">
          Operational Readiness
        </span>
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {services.map((svc) => (
            <div
              key={svc.id}
              className="p-3.5 rounded-lg border border-border bg-surface-muted/40 flex flex-col justify-between space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-surface border border-border text-foreground">
                    {getComponentIcon(svc.component)}
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-foreground leading-tight">
                      {svc.name}
                    </h4>
                    <span className="text-[10px] font-mono text-muted-foreground block">
                      {svc.version}
                    </span>
                  </div>
                </div>

                <StatusIndicator
                  status={svc.status}
                  label={svc.statusLabel}
                  showPulse={svc.status === 'running'}
                  className="text-xs"
                />
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed pt-1 border-t border-border/50">
                {svc.detail}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
