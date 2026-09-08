import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PackagePlus, Sprout, Wallet, Inbox, ArrowRight, Truck, Calendar, User, MapPin } from "lucide-react";
import { ListingStatus, OfferStatus, OrderStatus } from "@kisansetu/shared";
import { useAuth } from "../../hooks/useAuth";
import { listingApi, offerApi, orderApi } from "../../lib/api";
import { StatCard } from "../../components/ui/StatCard";
import { Card, CardHeader, CardTitle } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { SkeletonList } from "../../components/ui/Skeleton";
import { getCropName } from "../../utils/cropNames";

export function FarmerHomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const listingsQuery = useQuery({ queryKey: ["listings", "mine"], queryFn: () => listingApi.mine() });
  const offersQuery = useQuery({ queryKey: ["offers", "mine"], queryFn: () => offerApi.list() });
  const ordersQuery = useQuery({ queryKey: ["orders", "farmer"], queryFn: () => orderApi.list() });

  const listings = listingsQuery.data?.listings ?? [];
  const offers = offersQuery.data?.offers ?? [];
  const orders = ordersQuery.data?.orders ?? [];

  const activeListings = listings.filter((l) => l.status === ListingStatus.ACTIVE).length;
  const pendingOffers = offers.filter((o) => o.status === OfferStatus.PENDING || o.status === OfferStatus.COUNTERED).length;
  const totalEarnings = offers
    .filter((o) => o.status === OfferStatus.ACCEPTED)
    .reduce((sum, o) => sum + o.offeredPricePerKg * o.quantityKg, 0);

  const upcomingPickups = orders.filter(
    (o) => o.pickup && (o.status === OrderStatus.PICKUP_SCHEDULED || o.status === OrderStatus.IN_TRANSIT)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-charcoal-900">
          {t("farmer.homeTitle")}, {user?.name.split(" ")[0]}
        </h1>
        <p className="text-sm text-charcoal-600">
          {user?.region ? `${user.region}${user.village ? ` · ${user.village}` : ""}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label={t("farmer.activeListings")} value={activeListings} icon={Sprout} tone="brand" />
        <StatCard label={t("farmer.pendingOffers")} value={pendingOffers} icon={Inbox} tone="clay" />
        <StatCard label={t("farmer.totalEarnings")} value={totalEarnings} prefix="₹" icon={Wallet} tone="fresh" />
      </div>

      <Link
        to="/farmer/list-produce"
        className="flex items-center justify-between rounded-xl bg-brand-700 px-5 py-4 text-cream-50 shadow-sm transition-transform active:scale-[0.99]"
      >
        <span className="flex items-center gap-3 font-semibold">
          <PackagePlus className="h-5 w-5" /> {t("farmer.listProduceTitle")}
        </span>
        <ArrowRight className="h-5 w-5" />
      </Link>

      {/* 🚚 Upcoming Pickups & Driver Details */}
      {upcomingPickups.length > 0 && (
        <Card className="border-brand-200 bg-brand-50/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-brand-700" />
              <CardTitle>{t("farmer.upcomingPickupsTitle")}</CardTitle>
            </div>
            <Link to="/farmer/orders" className="text-xs font-semibold text-brand-700">
              {t("common.viewAll")}
            </Link>
          </CardHeader>
          <div className="space-y-3">
            {upcomingPickups.map((o) => {
              const p = o.pickup!;
              const cropName = o.crop ? getCropName(o.crop, t) : "";
              return (
                <div key={o.id} className="rounded-xl border border-brand-200 bg-white p-4 shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sm text-charcoal-900">{o.orderCode}</span>
                      {cropName && <span className="ml-2 text-xs font-semibold text-brand-700">· {cropName}</span>}
                    </div>
                    <Badge tone="warning">
                      {t(`orderStatus.${o.status}`, o.status.replace(/_/g, " "))}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-charcoal-700 pt-1">
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-brand-600 shrink-0" />
                      <span>
                        <strong className="text-charcoal-900">{t("logistics.driver")}:</strong> {p.driverName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Truck className="h-3.5 w-3.5 text-brand-600 shrink-0" />
                      <span>
                        <strong className="text-charcoal-900">{t("logistics.vehicle")}:</strong> {p.vehicleNumber}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-brand-600 shrink-0" />
                      <span>
                        <strong className="text-charcoal-900">{t("logistics.time")}:</strong> {p.scheduledDate} at {p.scheduledTime}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-brand-600 shrink-0" />
                      <span className="truncate">
                        <strong className="text-charcoal-900">{t("logistics.location")}:</strong> {p.location}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("nav.listProduce")}</CardTitle>
          <Link to="/farmer/orders" className="text-xs font-semibold text-brand-700">
            {t("common.viewAll")}
          </Link>
        </CardHeader>
        {listingsQuery.isLoading ? (
          <SkeletonList count={2} />
        ) : listingsQuery.isError ? (
          <ErrorState error={listingsQuery.error} onRetry={() => listingsQuery.refetch()} />
        ) : listings.length === 0 ? (
          <EmptyState icon={Sprout} title={t("common.noResults")} description={t("farmer.orders.noOrdersDesc")} />
        ) : (
          <div className="space-y-2.5">
            {listings.slice(0, 4).map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-lg bg-cream-100 px-3.5 py-3">
                <div>
                  <p className="text-sm font-semibold text-charcoal-900">{getCropName(l.crop, t)}</p>
                  <p className="text-xs text-charcoal-600">
                    {l.remainingQuantityKg}/{l.quantityKg} kg · ₹{l.expectedPricePerKg}/kg
                  </p>
                </div>
                <Badge tone={l.status === ListingStatus.ACTIVE ? "success" : "neutral"}>
                  {t(`listingStatus.${l.status}`, l.status)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("farmer.pendingOffers")}</CardTitle>
        </CardHeader>
        {offersQuery.isLoading ? (
          <SkeletonList count={2} />
        ) : offers.length === 0 ? (
          <EmptyState icon={Inbox} title={t("farmer.offers.noOffersYet")} description={t("farmer.offers.noOffersDesc")} />
        ) : (
          <div className="space-y-2.5">
            {offers.slice(0, 4).map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-lg bg-cream-100 px-3.5 py-3">
                <div>
                  <p className="text-sm font-semibold text-charcoal-900">
                    {o.crop ? `${getCropName(o.crop, t)} · ` : ""}₹{o.offeredPricePerKg}/kg × {o.quantityKg}kg
                  </p>
                  <p className="text-xs text-charcoal-600">{new Date(o.createdAt).toLocaleDateString()}</p>
                </div>
                <Badge tone={o.status === OfferStatus.ACCEPTED ? "success" : o.status === OfferStatus.REJECTED ? "danger" : "info"}>
                  {t(`offerStatus.${o.status}`, o.status)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
