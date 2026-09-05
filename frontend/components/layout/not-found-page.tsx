import React from 'react';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { useRouter } from '@/lib/router';

export function NotFoundPage() {
  const router = useRouter();

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-2">
      <Card className="w-full p-6 text-center sm:p-8">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-warning/30 bg-warning/10 text-warning">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This AgentOps route does not exist or is not available in Phase 1.
        </p>
        <Button className="mt-5" onClick={() => router.push('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          Back to Dashboard
        </Button>
      </Card>
    </div>
  );
}
