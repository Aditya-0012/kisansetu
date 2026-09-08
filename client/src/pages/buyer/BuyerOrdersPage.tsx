import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ClipboardList, MessageSquare, Truck, User, Calendar, MapPin } from "lucide-react";
import { Offer, OfferStatus } from "@kisansetu/shared";
import { offerApi, orderApi, ApiRequestError } from "../../lib/api";
import { Badge, orderStatusTone } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { SkeletonList } from "../../components/ui/Skeleton";
import { useToast } from "../../components/ui/Toast";
import { getCropName } from "../../utils/cropNames";
import { cn } from "../../lib/cn";

function BuyerOfferRow({ offer }: { offer: Offer }) {
  const { t } = useTranslation();
  const { push } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [counterPrice, setCounterPrice] = useState("");
  const [showCounter, setShowCounter] = useState(false);

  const lastAction = offer.history?.[offer.history.length - 1];
  const farmerActedLast = lastAction?.actor === "farmer";
  const canRespondToCounter = offer.status === OfferStatus.COUNTERED && farmerActedLast;
  const isAccepted = offer.status === OfferStatus.ACCEPTED;

  const respond = useMutation({
    mutationFn: (body: { action: "accept" | "reject" | "counter"; counterPricePerKg?: number }) =>
      offerApi.respond(offer.id, body),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["offers", "buyer"] });
      push({
        kind: vars.action === "reject" ? "info" : "success",
        title: vars.action === "counter" ? t("buyer.offers.sendCounter") : t("common.confirm"),
      });
      setShowCounter(false);
    },
    onError: (err) =>
      push({ kind: "error", title: err instanceof ApiRequestError ? err.message : t("common.somethingWentWrong") }),
  });

  const confirmOrder = useMutation({
    mutationFn: async () => {
      if (canRespondToCounter) {
        await offerApi.respond(offer.id, { action: "accept" });
      }
      return offerApi.confirmOrder(offer.id);
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["offers", "buyer"] });
      qc.invalidateQueries({ queryKey: ["orders", "buyer"] });
      push({ kind: "success", title: t("buyer.offers.acceptConfirm") });
      navigate(`/buyer/orders/${res.order.id}`);
    },
    onError: (err) =>
      push({ kind: "error", title: err instanceof ApiRequestError ? err.message : t("common.somethingWentWrong") }),
  });

  const cropName = offer.crop ? getCropName(offer.crop, t) : t("crops.produce");

  return (
    <div className="rounded-xl border border-charcoal-900/8 bg-white p-5 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display font-bold text-charcoal-900 text-base">{cropName}</h3>
            {offer.farmerName && (
              <span className="text-xs text-charcoal-500 font-medium">
                · {t("buyer.offers.farmerLabel")}: {offer.farmerName}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-charcoal-800 mt-1">
            ₹{offer.offeredPricePerKg}/kg × {offer.quantityKg} kg
            <span className="text-xs font-normal text-charcoal-600 ml-2">
              ({t("common.total")}: ₹{(offer.offeredPricePerKg * offer.quantityKg).toLocaleString("en-IN")})
            </span>
          </p>
        </div>
        <Badge
          tone={
            offer.status === OfferStatus.ACCEPTED
              ? "success"
              : offer.status === OfferStatus.REJECTED
              ? "danger"
              : offer.status === OfferStatus.COUNTERED
              ? "warning"
              : "info"
          }
        >
          {t(`offerStatus.${offer.status}`, offer.status)}
        </Badge>
      </div>

      {canRespondToCounter && (
        <div className="rounded-lg bg-amber-50/80 border border-amber-200/60 p-3.5 space-y-2">
          <p className="text-xs font-medium text-amber-900">
            {t("buyer.offers.farmerCounteredWith")} <span className="font-bold text-sm">₹{offer.offeredPricePerKg}/kg</span>.
            {lastAction?.note && <span className="block text-amber-800 italic mt-0.5">"{lastAction.note}"</span>}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              size="sm"
              onClick={() => confirmOrder.mutate()}
              loading={confirmOrder.isPending || respond.isPending}
            >
              {t("buyer.offers.acceptConfirm")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowCounter((v) => !v)}
              disabled={confirmOrder.isPending}
            >
              {t("buyer.offers.counterBack")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => respond.mutate({ action: "reject" })}
              disabled={confirmOrder.isPending || respond.isPending}
            >
              {t("buyer.offers.reject")}
            </Button>
          </div>
        </div>
      )}

      {isAccepted && (
        <div className="rounded-lg bg-emerald-50/80 border border-emerald-200/60 p-3.5 flex items-center justify-between gap-4">
          <p className="text-xs font-medium text-emerald-900">
            {t("buyer.offers.farmerAccepted", { price: offer.offeredPricePerKg })}
          </p>
          <Button
            size="sm"
            onClick={() => confirmOrder.mutate()}
            loading={confirmOrder.isPending}
          >
            {t("buyer.offers.confirmPayEscrow")}
          </Button>
        </div>
      )}

      {offer.status === OfferStatus.PENDING && (
        <p className="text-xs text-charcoal-500 bg-charcoal-50 px-2.5 py-1.5 rounded-md inline-block">
          {t("buyer.offers.initialOfferSent")}
        </p>
      )}

      {offer.status === OfferStatus.COUNTERED && !farmerActedLast && (
        <p className="text-xs text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-md inline-block">
          {t("buyer.offers.counterOfferSent", { price: offer.offeredPricePerKg })}
        </p>
      )}

      {offer.status === OfferStatus.REJECTED && (
        <p className="text-xs text-rose-600 bg-rose-50 px-2.5 py-1.5 rounded-md inline-block">
          {t("buyer.offers.offerRejected")}
        </p>
      )}

      {showCounter && (
        <div className="flex items-center gap-2 pt-2 border-t border-charcoal-100">
          <Input
            placeholder={t("buyer.offers.counterPricePlaceholder")}
            type="number"
            value={counterPrice}
            onChange={(e) => setCounterPrice(e.target.value)}
            className="max-w-[160px]"
          />
          <Button
            size="sm"
            onClick={() => respond.mutate({ action: "counter", counterPricePerKg: Number(counterPrice) })}
            disabled={!counterPrice || Number(counterPrice) <= 0}
            loading={respond.isPending}
          >
            {t("buyer.offers.sendCounter")}
          </Button>
        </div>
      )}
    </div>
  );
}

export function BuyerOrdersPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"orders" | "offers">("orders");

  const ordersQuery = useQuery({ queryKey: ["orders", "buyer"], queryFn: () => orderApi.list() });
  const offersQuery = useQuery({ queryKey: ["offers", "buyer"], queryFn: () => offerApi.list() });

  const orders = ordersQuery.data?.orders ?? [];
  const offers = offersQuery.data?.offers ?? [];

  const pendingOffersCount = offers.filter(
    (o) => o.status === OfferStatus.PENDING || o.status === OfferStatus.COUNTERED || o.status === OfferStatus.ACCEPTED
  ).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-charcoal-900">{t("buyer.ordersTitle")}</h1>
      </div>

      <div className="flex border-b border-charcoal-900/10">
        <button
          onClick={() => setTab("orders")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
            tab === "orders"
              ? "border-brand-600 text-brand-700"
              : "border-transparent text-charcoal-600 hover:text-charcoal-900"
          )}
        >
          <ClipboardList className="h-4 w-4" />
          {t("buyer.tabs.myOrders")} ({orders.length})
        </button>
        <button
          onClick={() => setTab("offers")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
            tab === "offers"
              ? "border-brand-600 text-brand-700"
              : "border-transparent text-charcoal-600 hover:text-charcoal-900"
          )}
        >
          <MessageSquare className="h-4 w-4" />
          {t("buyer.tabs.offersAndNegotiations")}
          {pendingOffersCount > 0 && (
            <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs text-white">
              {pendingOffersCount}
            </span>
          )}
        </button>
      </div>

      {tab === "orders" ? (
        ordersQuery.isLoading ? (
          <SkeletonList count={3} />
        ) : ordersQuery.isError ? (
          <ErrorState error={ordersQuery.error} onRetry={() => ordersQuery.refetch()} />
        ) : orders.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={t("farmer.orders.noOrdersYet")}
            description={t("farmer.orders.noOrdersDesc")}
          />
        ) : (
          <div className="space-y-3">
            {orders.map((o) => {
              const cropName = o.crop ? getCropName(o.crop, t) : "";
              return (
                <Link
                  key={o.id}
                  to={`/buyer/orders/${o.id}`}
                  className="card block p-4 hover:shadow-card-hover space-y-2 transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-charcoal-900">{o.orderCode}</p>
                      <p className="text-xs text-charcoal-600">
                        {cropName} · {o.totalQuantityKg} kg · ₹{o.totalAmount.toLocaleString("en-IN")}
                      </p>
                    </div>
                    <Badge tone={orderStatusTone(o.status)}>
                      {t(`orderStatus.${o.status}`, o.status.replace(/_/g, " "))}
                    </Badge>
                  </div>

                  {o.pickup && (
                    <div className="mt-2 rounded-lg bg-brand-50/70 border border-brand-200/70 p-2.5 text-xs text-charcoal-700 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="flex items-center gap-1 font-semibold text-brand-900">
                        <Truck className="h-3.5 w-3.5 text-brand-700" />
                        {t("logistics.driver")}: {o.pickup.driverName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-brand-600" />
                        {o.pickup.scheduledDate} {o.pickup.scheduledTime}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-brand-600" />
                        {o.pickup.location}
                      </span>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )
      ) : (
        offersQuery.isLoading ? (
          <SkeletonList count={3} />
        ) : offersQuery.isError ? (
          <ErrorState error={offersQuery.error} onRetry={() => offersQuery.refetch()} />
        ) : offers.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title={t("buyer.offers.noOffersTitle")}
            description={t("buyer.offers.noOffersDesc")}
          />
        ) : (
          <div className="space-y-3">
            {offers.map((offer) => (
              <BuyerOfferRow key={offer.id} offer={offer} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
