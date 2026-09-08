import { AlertTriangle, WifiOff } from "lucide-react";
import { ApiRequestError } from "../../lib/api";
import { Button } from "./Button";

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const isNetwork = error instanceof ApiRequestError && error.status === 0;
  const message = error instanceof ApiRequestError ? error.message : "Something went wrong. Please try again.";

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-state-danger/20 bg-red-50/50 px-6 py-10 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white">
        {isNetwork ? <WifiOff className="h-5 w-5 text-state-danger" /> : <AlertTriangle className="h-5 w-5 text-state-danger" />}
      </div>
      <p className="max-w-sm text-sm font-medium text-charcoal-800">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
