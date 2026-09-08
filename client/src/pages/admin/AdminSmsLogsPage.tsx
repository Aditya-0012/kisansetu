import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquareText, Send, CheckCircle2, XCircle } from "lucide-react";
import { adminApi, smsApi, ApiRequestError } from "../../lib/api";
import { Card, CardHeader, CardTitle } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Skeleton } from "../../components/ui/Skeleton";
import { ErrorState } from "../../components/ui/ErrorState";
import { useToast } from "../../components/ui/Toast";

export function AdminSmsLogsPage() {
  const { push } = useToast();
  const qc = useQueryClient();
  const [phone, setPhone] = useState("");
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ["admin", "sms-logs"], queryFn: () => adminApi.smsLogs() });

  const sendTest = useMutation({
    mutationFn: () => smsApi.test(phone),
    onSuccess: (res) => {
      push({ kind: "success", title: `Test SMS ${res.status} via ${res.provider}` });
      setPhone("");
      qc.invalidateQueries({ queryKey: ["admin", "sms-logs"] });
    },
    onError: (err) => push({ kind: "error", title: err instanceof ApiRequestError ? err.message : "Could not send test SMS" }),
  });

  const metrics = data?.metrics;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-charcoal-900">{"SMS Center"}</h1>
        <p className="text-sm text-charcoal-600">Every SMS in KisanSetu runs through a provider-agnostic abstraction — mock by default, no credentials required.</p>
      </div>

      {metrics && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4">
            <p className="text-xs font-semibold text-charcoal-600">Sent</p>
            <p className="mt-1 font-display text-xl font-extrabold text-charcoal-900">{metrics.sent}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-semibold text-charcoal-600">Delivered</p>
            <p className="mt-1 font-display text-xl font-extrabold text-state-success">{metrics.delivered}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-semibold text-charcoal-600">Failed</p>
            <p className="mt-1 font-display text-xl font-extrabold text-state-danger">{metrics.failed}</p>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Send test SMS</CardTitle>
        </CardHeader>
        <div className="flex items-end gap-3">
          <Input label="Phone number" placeholder="9876543210" value={phone} onChange={(e) => setPhone(e.target.value)} className="max-w-[200px]" />
          <Button loading={sendTest.isPending} disabled={!phone} onClick={() => sendTest.mutate()}>
            <Send className="h-4 w-4" /> Send
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <MessageSquareText className="h-4 w-4" /> Recent messages
          </CardTitle>
        </CardHeader>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : (
          <div className="space-y-2">
            {(data?.recent ?? []).map((log) => (
              <div key={log.id} className="flex items-start justify-between gap-3 rounded-lg bg-cream-100 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-charcoal-900">
                    {log.recipientName ?? log.recipientPhone} <span className="font-normal text-charcoal-600">· {log.recipientPhone}</span>
                  </p>
                  <p className="truncate text-xs text-charcoal-600">{log.message}</p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <Badge tone="neutral">{log.provider}</Badge>
                  <Badge tone={log.status === "failed" ? "danger" : "success"}>
                    {log.status === "failed" ? <XCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                    {log.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
