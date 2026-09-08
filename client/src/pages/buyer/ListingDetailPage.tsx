import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, MapPin, Calendar, Star } from "lucide-react";
import { listingApi, offerApi, ApiRequestError } from "../../lib/api";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Skeleton } from "../../components/ui/Skeleton";
import { ErrorState } from "../../components/ui/ErrorState";
import { useToast } from "../../components/ui/Toast";
import { getCropName } from "../../utils/cropNames";

export function ListingDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { push } = useToast();
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["listings", id],
    queryFn: () => listingApi.getById(id!),
    enabled: !!id,
  });

  const listing = data?.listing;

  const makeOffer = useMutation({
    mutationFn: () =>
      offerApi.create({
        listingId: id!,
        offeredPricePerKg: Number(price),
        quantityKg: Number(qty),
      }),
    onSuccess: () => {
      push({ kind: "success", title: t("buyer.offers.initialOfferSent") });
      navigate("/buyer/orders");
    },
    onError: (err) =>
      push({ kind: "error", title: err instanceof ApiRequestError ? err.message : t("common.somethingWentWrong") }),
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!listing) return <ErrorState error={new Error("Listing not found")} />;

  return (
    <div className="space-y-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-semibold text-charcoal-700">
        <ArrowLeft className="h-4 w-4" /> {t("common.back")}
      </button>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold text-charcoal-900">{getCropName(listing.crop, t)}</h1>
              {listing.variety && <p className="text-sm text-charcoal-600">{listing.variety}</p>}
            </div>
            <Badge tone="brand">
              {t("qualityGrades.grade")} {listing.quality}
            </Badge>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-xs text-charcoal-600">{t("farmer.form.expectedPrice")}</p>
              <p className="font-display text-lg font-bold text-brand-700">₹{listing.expectedPricePerKg}/kg</p>
            </div>
            <div>
              <p className="text-xs text-charcoal-600">{t("buyer.available")}</p>
              <p className="font-display text-lg font-bold text-charcoal-900">{listing.remainingQuantityKg} kg</p>
            </div>
            <div>
              <p className="text-xs text-charcoal-600">{t("buyer.offers.farmerLabel")}</p>
              <p className="flex items-center gap-1 text-sm font-semibold text-charcoal-900">
                {listing.farmerName} <Star className="h-3.5 w-3.5 fill-earth-wheat text-earth-wheat" /> {listing.farmerRating.toFixed(1)}
              </p>
            </div>
            <div>
              <p className="text-xs text-charcoal-600">{t("farmer.form.harvestDate")}</p>
              <p className="flex items-center gap-1 text-sm font-semibold text-charcoal-900">
                <Calendar className="h-3.5 w-3.5" /> {new Date(listing.harvestDate).toLocaleDateString()}
              </p>
            </div>
          </div>

          <p className="mt-4 flex items-center gap-1.5 text-sm text-charcoal-700">
            <MapPin className="h-4 w-4" /> {listing.region}
            {listing.village ? `, ${listing.village}` : ""}
          </p>

          {listing.description && <p className="mt-4 text-sm text-charcoal-700">{listing.description}</p>}
        </Card>

        <Card>
          <h2 className="font-display text-base font-bold text-charcoal-900">{t("buyer.negotiate")}</h2>
          <div className="mt-4 space-y-3">
            <Input
              label={t("farmer.form.expectedPrice")}
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={String(listing.expectedPricePerKg)}
            />
            <Input
              label={t("farmer.form.quantity")}
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder={String(listing.remainingQuantityKg)}
            />
            <Button fullWidth disabled={!price || !qty} loading={makeOffer.isPending} onClick={() => makeOffer.mutate()}>
              {t("buyer.offers.sendCounter")}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
