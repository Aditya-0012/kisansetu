import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { Radar, MapPin, Star, Users, PackageCheck, Sparkles } from "lucide-react";
import { CROP_LABELS, CropCategory, REGIONS } from "@kisansetu/shared";
import { aggregationApi, ApiRequestError } from "../../lib/api";
import { Card } from "../../components/ui/Card";
import { Input, Select } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { useToast } from "../../components/ui/Toast";
import { getCropName } from "../../utils/cropNames";

const SCAN_STEPS = ["Scanning nearby listings…", "Ranking by distance, price & rating…", "Assembling optimal batch…"];

export function BuyerFindSupplyPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { push } = useToast();
  const [crop, setCrop] = useState<CropCategory>(CropCategory.TOMATO);
  const [quantityKg, setQuantityKg] = useState("500");
  const [region, setRegion] = useState<string>(REGIONS[1]);
  const [scanStep, setScanStep] = useState(0);

  const findMutation = useMutation({
    mutationFn: async () => {
      // Step through the narrative states while the real request is in
      // flight — the request itself typically resolves in well under a
      // second against seeded data, so we pace the reveal a little to make
      // the aggregation engine's work legible rather than instantaneous.
      const stepper = setInterval(() => setScanStep((s) => Math.min(s + 1, SCAN_STEPS.length - 1)), 550);
      try {
        const result = await aggregationApi.find({ crop, requiredQuantityKg: Number(quantityKg), destinationRegion: region });
        await new Promise((r) => setTimeout(r, 600));
        return result;
      } finally {
        clearInterval(stepper);
      }
    },
    onError: (err) => push({ kind: "error", title: err instanceof ApiRequestError ? err.message : "Could not find supply" }),
    onSettled: () => setScanStep(0),
  });

  const confirmMutation = useMutation({
    mutationFn: (batchId: string) => aggregationApi.confirm(batchId),
    onSuccess: ({ order }) => {
      push({ kind: "success", title: "Order confirmed", description: `${order.orderCode} — payment held in escrow.` });
      navigate(`/buyer/orders/${order.id}`);
    },
    onError: (err) => push({ kind: "error", title: err instanceof ApiRequestError ? err.message : "Could not confirm order" }),
  });

  const batch = findMutation.data?.batch;
  const fulfillmentPct = batch ? Math.min(100, Math.round((batch.fulfilledQuantityKg / batch.requestedQuantityKg) * 100)) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-charcoal-900">{t("buyer.findSupplyTitle")}</h1>
        <p className="text-sm text-charcoal-600">{t("buyer.findSupplySubtitle")}</p>
      </div>

      <Card className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <Select label={t("buyer.crop")} value={crop} onChange={(e) => setCrop(e.target.value as CropCategory)}>
          {Object.values(CropCategory).map((c) => (
            <option key={c} value={c}>
              {getCropName(c, t)}
            </option>
          ))}
        </Select>
        <Input label={t("buyer.quantityNeeded")} type="number" value={quantityKg} onChange={(e) => setQuantityKg(e.target.value)} />
        <Select label={t("auth.region")} value={region} onChange={(e) => setRegion(e.target.value)}>
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
        <Button onClick={() => findMutation.mutate()} loading={findMutation.isPending} disabled={!quantityKg || Number(quantityKg) <= 0}>
          {t("nav.findSupply")}
        </Button>
      </Card>

      <AnimatePresence mode="wait">
        {findMutation.isPending && (
          <motion.div
            key="scanning"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center gap-4 rounded-xl border border-brand-200 bg-brand-50/50 py-16"
          >
            <div className="relative flex h-16 w-16 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-brand-500/40" />
              <Radar className="relative h-8 w-8 text-brand-700" />
            </div>
            <p className="font-semibold text-brand-800">{SCAN_STEPS[scanStep]}</p>
          </motion.div>
        )}

        {batch && !findMutation.isPending && (
          <motion.div key="results" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-fresh-500/15 text-fresh-600">
                    <PackageCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-display text-lg font-bold text-charcoal-900">{t("buyer.batchFound")}</p>
                    <p className="text-xs text-charcoal-600">{batch.listingsAnalyzed} listings analyzed · {batch.contributions.length} farmers combined</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl font-extrabold text-brand-700">₹{batch.estimatedTotal.toLocaleString("en-IN")}</p>
                  <p className="text-xs text-charcoal-600">₹{batch.weightedPricePerKg.toFixed(2)}/kg weighted avg</p>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-xs text-charcoal-600">
                  <span>
                    {batch.fulfilledQuantityKg} / {batch.requestedQuantityKg} kg fulfilled
                  </span>
                  <span>{fulfillmentPct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-charcoal-900/8">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${fulfillmentPct}%` }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                    className={fulfillmentPct >= 95 ? "h-full bg-state-success" : "h-full bg-state-warning"}
                  />
                </div>
                {fulfillmentPct < 95 && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-state-warning">
                    <Sparkles className="h-3.5 w-3.5" /> Supply gap — nearby farmers currently list less than requested. Consider a smaller order or check back after harvest.
                  </p>
                )}
              </div>
            </Card>

            <Card>
              <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold text-charcoal-900">
                <Users className="h-4 w-4" /> Contributing farmers
              </h3>
              <div className="space-y-2">
                {batch.contributions.map((c, i) => (
                  <motion.div
                    key={c.listingId}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="flex items-center justify-between rounded-lg bg-cream-100 px-3.5 py-2.5"
                  >
                    <div>
                      <p className="text-sm font-semibold text-charcoal-900">{c.farmerName}</p>
                      <p className="flex items-center gap-2 text-xs text-charcoal-600">
                        <MapPin className="h-3 w-3" /> {c.distanceKm.toFixed(1)} km
                        <Star className="h-3 w-3 fill-earth-wheat text-earth-wheat" /> {c.farmerRating.toFixed(1)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-charcoal-900">{c.quantityKg} kg</p>
                      <p className="text-xs text-charcoal-600">₹{c.subtotal.toLocaleString("en-IN")}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <Button fullWidth className="mt-5" loading={confirmMutation.isPending} onClick={() => confirmMutation.mutate(batch.id)}>
                Confirm order & hold payment in escrow
              </Button>
              <p className="mt-2 text-center text-[11px] text-charcoal-600/70">{t("common.demoMode")} — no real money moves.</p>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
