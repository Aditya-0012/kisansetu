import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { adminApi } from "../../lib/api";
import { Card, CardHeader, CardTitle } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";
import { ErrorState } from "../../components/ui/ErrorState";
import { EmptyState } from "../../components/ui/EmptyState";

export function AdminAuditLogPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ["admin", "audit-log"], queryFn: () => adminApi.auditLog() });
  const logs = Array.isArray(data) ? data : data?.logs ?? [];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-charcoal-900">Audit Log</h1>
      <p className="text-sm text-charcoal-600">
        Every state-changing action in KisanSetu — offers, orders, batches, payments — is recorded here for traceability.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <ScrollText className="h-4 w-4" /> Recent activity ({logs.length})
          </CardTitle>
        </CardHeader>
        {isLoading ? (
          <Skeleton className="h-80 w-full" />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : logs.length === 0 ? (
          <EmptyState icon={ScrollText} title="No activity yet" />
        ) : (
          <div className="space-y-1.5">
            {logs.map((entry) => (
              <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-charcoal-900/5 py-2.5 text-sm last:border-0">
                <div className="flex items-center gap-2.5">
                  <span className="font-semibold text-charcoal-900 capitalize">{entry.action.replace(/_/g, " ")}</span>
                  <span className="rounded bg-charcoal-100 px-1.5 py-0.5 text-xs text-charcoal-700">
                    {entry.entityType}
                  </span>
                  {entry.entityId && (
                    <span className="text-xs text-charcoal-500 font-mono">
                      #{entry.entityId.slice(0, 8)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-charcoal-600">
                  {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                    <span className="font-mono text-brand-700 max-w-xs truncate hidden md:inline">
                      {JSON.stringify(entry.metadata)}
                    </span>
                  )}
                  <span className="flex-shrink-0">{new Date(entry.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
