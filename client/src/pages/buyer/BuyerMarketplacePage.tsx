import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Search, MapPin, Star, PackageSearch } from "lucide-react";
import { CropCategory, QualityGrade, REGIONS } from "@kisansetu/shared";
import { listingApi } from "../../lib/api";
import { Card } from "../../components/ui/Card";
import { Input, Select } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { SkeletonList } from "../../components/ui/Skeleton";
import { getCropName } from "../../utils/cropNames";

export function BuyerMarketplacePage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [crop, setCrop] = useState("");
  const [region, setRegion] = useState("");
  const [quality, setQuality] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["listings", "search", { search, crop, region, quality, page }],
    queryFn: () =>
      listingApi.search({
        search: search || undefined,
        crop: crop || undefined,
        region: region || undefined,
        quality: quality || undefined,
        page,
        pageSize: 12,
      }),
  });

  const listings = data?.listings ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-bold text-charcoal-900">{t("buyer.marketplaceTitle")}</h1>
        <Link to="/buyer/find-supply" className="btn-primary btn">
          <PackageSearch className="h-4 w-4" /> {t("nav.findSupply")}
        </Link>
      </div>

      <Card className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input
            label={t("common.search")}
            placeholder={t("buyer.marketplace.searchPlaceholder", "Search crop, variety, region...")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          label={t("buyer.crop")}
          value={crop}
          onChange={(e) => {
            setCrop(e.target.value);
            setPage(1);
          }}
          className="sm:max-w-[160px]"
        >
          <option value="">{t("buyer.allCrops")}</option>
          {Object.values(CropCategory).map((c) => (
            <option key={c} value={c}>
              {getCropName(c, t)}
            </option>
          ))}
        </Select>
        <Select
          label={t("auth.region")}
          value={region}
          onChange={(e) => {
            setRegion(e.target.value);
            setPage(1);
          }}
          className="sm:max-w-[150px]"
        >
          <option value="">{t("buyer.allRegions")}</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
        <Select
          label={t("buyer.quality")}
          value={quality}
          onChange={(e) => {
            setQuality(e.target.value);
            setPage(1);
          }}
          className="sm:max-w-[130px]"
        >
          <option value="">{t("buyer.allGrades")}</option>
          {Object.values(QualityGrade).map((q) => (
            <option key={q} value={q}>
              {t("qualityGrades.grade")} {q}
            </option>
          ))}
        </Select>
      </Card>

      {isLoading ? (
        <SkeletonList count={4} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : listings.length === 0 ? (
        <EmptyState
          icon={Search}
          title={t("buyer.noListingsMatch")}
          description={t("buyer.noListingsMatchDesc")}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <Link
              key={l.id}
              to={`/buyer/listings/${l.id}`}
              className="card p-4 transition-shadow hover:shadow-card-hover"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-base font-bold text-charcoal-900">{getCropName(l.crop, t)}</p>
                  {l.variety && <p className="text-xs text-charcoal-600">{l.variety}</p>}
                </div>
                <Badge tone="brand">
                  {t("qualityGrades.grade")} {l.quality}
                </Badge>
              </div>
              <p className="mt-3 font-display text-xl font-extrabold text-brand-700">₹{l.expectedPricePerKg}/kg</p>
              <p className="text-xs text-charcoal-600">
                {l.remainingQuantityKg} kg {t("buyer.available")}
              </p>
              <div className="mt-3 flex items-center justify-between border-t border-charcoal-900/8 pt-3 text-xs text-charcoal-600">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {l.region}
                </span>
                <span className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-earth-wheat text-earth-wheat" /> {l.farmerRating.toFixed(1)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="btn-secondary btn text-sm disabled:opacity-40"
          >
            {t("common.back")}
          </button>
          <span className="text-sm text-charcoal-600">
            {t("common.pageOf", { page, total: Math.ceil(data.total / data.pageSize) })}
          </span>
          <button
            disabled={page >= Math.ceil(data.total / data.pageSize)}
            onClick={() => setPage((p) => p + 1)}
            className="btn-secondary btn text-sm disabled:opacity-40"
          >
            {t("common.next")}
          </button>
        </div>
      )}
    </div>
  );
}
