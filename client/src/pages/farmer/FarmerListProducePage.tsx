import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { CropCategory, QualityGrade, REGIONS } from "@kisansetu/shared";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../components/ui/Toast";
import { listingApi, priceApi, ApiRequestError } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Input, Select, Textarea } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";
import { getCropName } from "../../utils/cropNames";

const schema = z.object({
  crop: z.nativeEnum(CropCategory),
  variety: z.string().optional(),
  quantityKg: z.coerce.number().positive("Enter a valid quantity"),
  expectedPricePerKg: z.coerce.number().positive("Enter a valid price"),
  harvestDate: z.string().min(1, "Select a harvest date"),
  quality: z.nativeEnum(QualityGrade),
  region: z.string().min(1),
  village: z.string().optional(),
  description: z.string().max(1000).optional(),
});
type FormValues = z.infer<typeof schema>;

export function FarmerListProducePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { region: user?.region ?? REGIONS[0], quality: QualityGrade.A, village: user?.village ?? "" },
  });

  const crop = watch("crop") ?? CropCategory.TOMATO;
  const region = watch("region") ?? REGIONS[0];

  const fairPriceQuery = useQuery({
    queryKey: ["fair-price", crop, region],
    queryFn: () => priceApi.fairPrice(crop, region),
    enabled: !!crop && !!region,
  });
  const suggestion = fairPriceQuery.data?.suggestion;

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      const { listing } = await listingApi.create(values);
      push({
        kind: "success",
        title: t("common.confirm"),
        description: `${getCropName(listing.crop, t)} · ${listing.quantityKg}kg`,
      });
      navigate("/farmer");
    } catch (err) {
      setServerError(err instanceof ApiRequestError ? err.message : t("common.somethingWentWrong"));
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card>
        <h1 className="font-display text-xl font-bold text-charcoal-900">{t("farmer.listProduceTitle")}</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select label={t("farmer.form.crop")} error={errors.crop?.message} {...register("crop")}>
              {Object.values(CropCategory).map((c) => (
                <option key={c} value={c}>
                  {getCropName(c, t)}
                </option>
              ))}
            </Select>
            <Select label={t("farmer.form.qualityGrade")} error={errors.quality?.message} {...register("quality")}>
              {Object.values(QualityGrade).map((q) => (
                <option key={q} value={q}>
                  {t("qualityGrades.grade")} {q}
                </option>
              ))}
            </Select>
          </div>

          <Input label={t("farmer.form.variety")} {...register("variety")} />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t("farmer.form.quantity")}
              type="number"
              step="0.1"
              error={errors.quantityKg?.message}
              {...register("quantityKg")}
            />
            <Input
              label={t("farmer.form.expectedPrice")}
              type="number"
              step="0.5"
              error={errors.expectedPricePerKg?.message}
              {...register("expectedPricePerKg")}
            />
          </div>

          <Input label={t("farmer.form.harvestDate")} type="date" error={errors.harvestDate?.message} {...register("harvestDate")} />

          <div className="grid grid-cols-2 gap-3">
            <Select label={t("auth.region")} error={errors.region?.message} {...register("region")}>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
            <Input label={t("auth.village")} {...register("village")} />
          </div>

          <Textarea
            label={t("farmer.form.description")}
            placeholder={t("farmer.form.descriptionPlaceholder")}
            {...register("description")}
          />

          {serverError && <p className="text-sm font-medium text-state-danger">{serverError}</p>}
          <Button type="submit" fullWidth loading={isSubmitting}>
            {t("farmer.form.publishListing")}
          </Button>
        </form>
      </Card>

      <div className="lg:sticky lg:top-20 lg:self-start">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-600" />
            <h2 className="font-display text-sm font-bold text-charcoal-900">{t("farmer.marketIntelligence")}</h2>
          </div>
          {fairPriceQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : suggestion ? (
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs font-semibold text-charcoal-600">{t("farmer.suggestedPrice")}</p>
                <p className="font-display text-xl font-extrabold text-brand-700">
                  ₹{suggestion.suggestedMin.toFixed(0)} – ₹{suggestion.suggestedMax.toFixed(0)}/kg
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-charcoal-700">
                <div className="rounded-lg bg-cream-100 px-3 py-2">
                  <p className="text-charcoal-600">{t("farmer.form.mandiPrice")}</p>
                  <p className="font-semibold">₹{suggestion.mandiPrice.toFixed(0)}</p>
                </div>
                <div className="rounded-lg bg-cream-100 px-3 py-2">
                  <p className="text-charcoal-600">{t("farmer.form.thirtyDayAvg")}</p>
                  <p className="font-semibold">₹{suggestion.thirtyDayAverage.toFixed(0)}</p>
                </div>
              </div>
              <p className="rounded-lg bg-brand-50 px-3 py-2.5 text-xs text-brand-800">{suggestion.recommendation}</p>
              <p className="text-[11px] text-charcoal-600/70">
                {t("farmer.form.demandLevel")}: <span className="font-semibold capitalize">{suggestion.demandLevel}</span>.{" "}
                {t("farmer.form.advisoryNote")}
              </p>
            </div>
          ) : (
            <p className="text-sm text-charcoal-600">{t("farmer.form.advisoryNote")}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
