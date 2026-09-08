import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, BellOff, Check } from "lucide-react";
import { notificationApi } from "../lib/api";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { SkeletonList } from "../components/ui/Skeleton";
import { cn } from "../lib/cn";

export function NotificationsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ["notifications"], queryFn: () => notificationApi.list() });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const notifications = data?.notifications ?? [];

  return (
    <div className="min-h-screen bg-cream-100">
      <div className="container-page max-w-2xl py-6">
        <div className="mb-5 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-semibold text-charcoal-700">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          {notifications.some((n) => !n.read) && (
            <Button variant="ghost" size="sm" loading={markAllRead.isPending} onClick={() => markAllRead.mutate()}>
              <Check className="h-4 w-4" /> Mark all read
            </Button>
          )}
        </div>

        <h1 className="mb-5 flex items-center gap-2 font-display text-2xl font-bold text-charcoal-900">
          <Bell className="h-5 w-5" /> Notifications
          {data && data.unreadCount > 0 && <span className="badge bg-brand-700 text-cream-50">{data.unreadCount} new</span>}
        </h1>

        {isLoading ? (
          <SkeletonList count={4} />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : notifications.length === 0 ? (
          <EmptyState icon={BellOff} title="No notifications yet" description="Updates on your offers, orders, and deliveries will show up here." />
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => !n.read && markRead.mutate(n.id)}
                className={cn("w-full rounded-lg border px-4 py-3 text-left transition-colors", n.read ? "border-charcoal-900/8 bg-white" : "border-brand-200 bg-brand-50")}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-charcoal-900">{n.title}</p>
                  {!n.read && <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-brand-600" />}
                </div>
                <p className="mt-0.5 text-sm text-charcoal-700">{n.body}</p>
                <p className="mt-1.5 text-xs text-charcoal-600/70">{new Date(n.createdAt).toLocaleString()}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
