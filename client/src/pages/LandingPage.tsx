import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Sprout,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Users,
  Truck,
  ShieldCheck,
  LineChart,
  Radar,
} from "lucide-react";
import { CROP_LABELS } from "@kisansetu/shared";
import { priceApi } from "../lib/api";
import { TopNav } from "../components/layout/TopNav";
import { Skeleton } from "../components/ui/Skeleton";
import { getCropName } from "../utils/cropNames";

const NAV_ITEMS = [{ to: "/demo-mode", key: "intelligence" }];

const PRODUCT_STORY = [
  { icon: LineChart, key: "forecast", title: "Forecast", body: "Historical demand and price signals surface which crops are in demand — and where — before you plant or sell." },
  { icon: Radar, key: "list", title: "List & Discover", body: "Farmers list produce with fair-price guidance; verified buyers discover it by crop, region, and quantity." },
  { icon: Users, key: "aggregate", title: "Aggregate", body: "The Smart Aggregation Engine combines nearby farmers' supply into one bulk-ready batch a wholesale buyer can actually use." },
  { icon: ShieldCheck, key: "escrow", title: "Negotiate & Escrow", body: "Offers, counter-offers, and a demo escrow hold protect both sides until produce is verified delivered." },
  { icon: Truck, key: "deliver", title: "Deliver & Settle", body: "Pickup logistics, delivery confirmation, and automatic per-farmer payout settlement close the loop." },
];

export function LandingPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({ queryKey: ["prices", "landing"], queryFn: () => priceApi.all() });
  const prices = data?.prices?.slice(0, 6) ?? [];

  return (
    <div className="min-h-screen bg-cream-100">
      <TopNav items={NAV_ITEMS} />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-charcoal-900/8">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_rgba(92,174,84,0.12),_transparent_60%)]" />
        <div className="container-page py-16 sm:py-24">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="max-w-2xl">
            <span className="badge bg-brand-50 text-brand-700 mb-5">
              <Sparkles className="h-3.5 w-3.5" /> Built for Smart India Hackathon
            </span>
            <h1 className="font-display text-4xl font-extrabold leading-[1.1] text-charcoal-900 sm:text-5xl">
              {t("landing.heroHeadline")}
            </h1>
            <p className="mt-5 text-lg text-charcoal-700">{t("landing.heroSub")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register" state={{ role: "farmer" }} className="btn-primary btn text-base px-6 py-3.5">
                <Sprout className="h-5 w-5" /> {t("landing.ctaFarmer")} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/register" state={{ role: "buyer" }} className="btn-secondary btn text-base px-6 py-3.5">
                <ShoppingBag className="h-5 w-5" /> {t("landing.ctaBuyer")}
              </Link>
            </div>
            <p className="mt-4 text-xs text-charcoal-600">
              Advisory intelligence, not guaranteed outcomes — see our{" "}
              <Link to="/demo-mode" className="underline decoration-dotted underline-offset-2">
                90-second live demo
              </Link>
              .
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Live Market Pulse ────────────────────────────────────────── */}
      <section className="container-page py-14">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-charcoal-900">{t("landing.marketPulse")}</h2>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-state-success">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-state-success/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-state-success" />
            </span>
            Live from seeded mandi data
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
            : prices.map((p) => (
                <div key={`${p.crop}-${p.region}`} className="card p-4">
                  <p className="text-xs font-semibold text-charcoal-600">{getCropName(p.crop, t)}</p>
                  <p className="text-[11px] text-charcoal-600/70">{p.region}</p>
                  <p className="mt-2 font-display text-lg font-extrabold text-charcoal-900">₹{p.pricePerKg.toFixed(0)}/kg</p>
                  <p className={`text-xs font-semibold ${p.changePercent >= 0 ? "text-state-success" : "text-state-danger"}`}>
                    {p.changePercent >= 0 ? "+" : ""}
                    {p.changePercent.toFixed(1)}%
                  </p>
                </div>
              ))}
        </div>
      </section>

      {/* ── Product story ────────────────────────────────────────────── */}
      <section className="border-y border-charcoal-900/8 bg-white py-16">
        <div className="container-page">
          <h2 className="font-display text-2xl font-bold text-charcoal-900">The full loop, not just a listing board</h2>
          <p className="mt-2 max-w-2xl text-charcoal-700">
            KisanSetu doesn't stop at "post a listing." Five connected stages take a harvest from forecast to a settled, rated transaction.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {PRODUCT_STORY.map((stage, i) => (
              <motion.div
                key={stage.key}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="card p-5"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <stage.icon className="h-5 w-5" />
                </div>
                <p className="text-xs font-bold uppercase tracking-wide text-brand-600">Stage {i + 1}</p>
                <h3 className="mt-1 font-display text-base font-bold text-charcoal-900">{stage.title}</h3>
                <p className="mt-1.5 text-sm text-charcoal-700">{stage.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Differentiator: aggregation ──────────────────────────────── */}
      <section className="container-page py-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <span className="badge bg-fresh-500/10 text-fresh-600 mb-4">Smart Aggregation Engine</span>
            <h2 className="font-display text-2xl font-bold text-charcoal-900">{t("landing.differentiatorTitle")}</h2>
            <p className="mt-3 text-charcoal-700">{t("landing.differentiatorSub")}</p>
            <ul className="mt-5 space-y-2.5 text-sm text-charcoal-800">
              <li className="flex gap-2"><TrendingUp className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-600" /> Ranks nearby listings on distance, price, quantity, and farmer rating.</li>
              <li className="flex gap-2"><TrendingUp className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-600" /> Greedily fills a buyer's bulk request across multiple small farms.</li>
              <li className="flex gap-2"><TrendingUp className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-600" /> Computes one weighted price and a transparent per-farmer payout split.</li>
            </ul>
            <Link to="/buyer/find-supply" className="btn-primary btn mt-6 inline-flex">
              See it run <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="card p-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-charcoal-600">Example: 500kg tomato → Pune</p>
            <div className="space-y-2.5">
              {[
                { name: "Ganesh Kadam", qty: "180 kg", dist: "4.2 km" },
                { name: "Vaishali Pawar", qty: "140 kg", dist: "6.8 km" },
                { name: "Ramesh More", qty: "110 kg", dist: "9.1 km" },
                { name: "Sunita Jadhav", qty: "70 kg", dist: "11.4 km" },
              ].map((f) => (
                <div key={f.name} className="flex items-center justify-between rounded-lg bg-cream-100 px-3.5 py-2.5 text-sm">
                  <span className="font-semibold text-charcoal-900">{f.name}</span>
                  <span className="text-charcoal-600">{f.qty} · {f.dist}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-charcoal-900/8 pt-4">
              <span className="text-sm font-semibold text-charcoal-700">4 farmers combined</span>
              <span className="font-display text-lg font-extrabold text-brand-700">500 kg</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Demand intelligence teaser ───────────────────────────────── */}
      <section className="border-t border-charcoal-900/8 bg-brand-800 py-16 text-cream-50">
        <div className="container-page grid items-center gap-8 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl font-bold">{t("landing.demandTeaserTitle")}</h2>
            <p className="mt-3 text-cream-100/80">{t("landing.demandTeaserSub")}</p>
            <Link to="/register" state={{ role: "farmer" }} className="btn mt-6 inline-flex bg-cream-50 text-brand-800 hover:bg-white">
              Explore demand intelligence <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="rounded-xl bg-white/5 p-5 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-wide text-cream-100/60">Model methodology (real, computed)</p>
            <p className="mt-2 text-sm text-cream-100/85">
              A RandomForest model trained on 150 days of seeded historical demand, evaluated against a 7-day moving-average
              baseline using a chronological hold-out split — the reported MAE/RMSE/MAPE are calculated from that data, not invented.
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-charcoal-900/8 bg-white py-10">
        <div className="container-page flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-base font-extrabold text-brand-700">{t("common.appName")}</p>
            <p className="mt-1 text-xs text-charcoal-600">A demo AgriTech platform built for Smart India Hackathon. No real payments are processed.</p>
          </div>
          <div className="rounded-lg bg-cream-100 px-4 py-3 text-xs text-charcoal-700">
            <p className="mb-1 font-semibold text-charcoal-900">Demo accounts (password: Demo@123)</p>
            <p>farmer@kisansetu.demo · buyer@kisansetu.demo · admin@kisansetu.demo</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
