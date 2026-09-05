import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } from '@/components/ui';
import { RECENT_COMMAND_PRESETS } from '@/lib/command-presets';
import { CommandPreset } from '@/types';
import { History, ArrowRight, Globe, Clock } from 'lucide-react';

export interface RecentCommandsListProps {
  onSelectPreset: (preset: CommandPreset) => void;
  disabled?: boolean;
}

export function RecentCommandsList({
  onSelectPreset,
  disabled = false,
}: RecentCommandsListProps) {
  return (
    <Card className="border-border bg-surface">
      <CardHeader className="pb-3 border-b border-border/80 flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          <CardTitle className="text-sm font-semibold text-foreground">
            Recent QA Commands &amp; Presets
          </CardTitle>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground">
          Quick Launch
        </span>
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {RECENT_COMMAND_PRESETS.map((preset) => (
            <div
              key={preset.id}
              className="p-3.5 rounded-lg border border-border bg-surface-muted/30 hover:bg-surface-muted/60 transition-colors flex flex-col justify-between space-y-2.5 text-xs group"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-1">
                  <Badge variant="outline" size="sm" className="text-[10px] font-mono">
                    {preset.category}
                  </Badge>
                  <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {preset.timestamp}
                  </span>
                </div>

                <h4 className="font-semibold text-foreground leading-snug group-hover:text-primary transition-colors">
                  {preset.title}
                </h4>

                <div className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground truncate">
                  <Globe className="w-3 h-3 shrink-0 opacity-70" />
                  <span className="truncate">{preset.targetUrl.replace(/^https?:\/\//, '')}</span>
                </div>

                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                  {preset.prompt}
                </p>
              </div>

              <div className="pt-2 border-t border-border/60 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  onClick={() => onSelectPreset(preset)}
                  className="h-7 px-2 text-[11px] text-primary hover:text-primary group-hover:translate-x-0.5 transition-transform"
                  rightIcon={<ArrowRight className="w-3 h-3" />}
                >
                  Load into Composer
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
