import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Play, RotateCcw, Check, Loader2, AlertTriangle,
  LineChart, Sparkles, Sprout, Search, Users, Handshake, ShieldCheck,
  Truck, Wallet, Brain, PackageCheck,
} from "lucide-react";
import { DEMO_STEPS, DemoApiError, createDemoContext, loginDemoActors, type DemoContext, type DemoStepResult } from "../lib/demoRunner";

type StepStatus = "pending" | "running" | "done" | "error";

const STAGE_ICONS: Record<string, typeof LineChart> = {
  FORECAST: LineChart,
  INFORM: Sparkles,
  LIST: Sprout,
  DISCOVER: Search,
  AGGREGATE: Users,
  NEGOTIATE: Handshake,
  ORDER: PackageCheck,
  LOGISTICS: Truck,
  ESCROW: ShieldCheck,
  DELIVER: Truck,
  SETTLE: Wallet,
  LEARN: Brain,
};

export function DemoModePage() {
  const [statuses, setStatuses] = useState<StepStatus[]>(DEMO_STEPS.map(() => "pending"));
  const [results, setResults] = useState<(DemoStepResult | null)[]>(DEMO_STEPS.map(() => null));
  const [running, setRunning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const ctxRef = useRef<DemoContext | null>(null);

  async function runDemo() {
    setRunning(true);
    setErrorMsg(null);
    setStatuses(DEMO_STEPS.map(() => "pending"));
    setResults(DEMO_STEPS.map(() => null));

    try {
      const actors = await loginDemoActors();
      ctxRef.current = createDemoContext(actors);
    } catch {
      setErrorMsg("Could not log in the demo accounts. Is the KisanSetu API running and seeded?");
      setRunning(false);
      return;
    }

    for (let i = 0; i < DEMO_STEPS.length; i++) {
      setStatuses((prev) => prev.map((s, idx) => (idx === i ? "running" : s)));
      try {
        const result = await DEMO_STEPS[i].run(ctxRef.current!);
        setResults((prev) => prev.map((r, idx) => (idx === i ? result : r)));
        setStatuses((prev) => prev.map((s, idx) => (idx === i ? "done" : s)));
        await new Promise((r) => setTimeout(r, 450));
      } catch (err) {
        setStatuses((prev) => prev.map((s, idx) => (idx === i ? "error" : s)));
        setErrorMsg(err instanceof DemoApiError ? err.message : "This step failed unexpectedly.");
        setRunning(false);
        return;
      }
    }
    setRunning(false);
  }

  function reset() {
    setStatuses(DEMO_STEPS.map(() => "pending"));
    setResults(DEMO_STEPS.map(() => null));
    setErrorMsg(null);
  }

  const completedCount = statuses.filter((s) => s === "done").length;

  return (
    <div className="min-h-screen bg-cream-100 pb-16">
      <div className="container-page py-6">
        <Link to="/" className="flex items-center gap-1.5 text-sm font-semibold text-charcoal-700">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="badge bg-brand-50 text-brand-700 mb-2">
              <Sparkles className="h-3.5 w-3.5" /> SIH Demo Mode
            </span>
            <h1 className="font-display text-3xl font-extrabold text-charcoal-900">The 90-second live walkthrough</h1>
            <p className="mt-2 max-w-xl text-sm text-charcoal-600">
              This runs against the real KisanSetu API using the three seeded demo accounts — every number below comes from an
              actual request, not a scripted animation.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={reset} disabled={running} className="btn-ghost btn disabled:opacity-40">
              <RotateCcw className="h-4 w-4" /> Reset
            </button>
            <button onClick={runDemo} disabled={running} className="btn-primary btn">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {running ? "Running…" : "Run the demo"}
            </button>
          </div>
        </div>

        <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-charcoal-900/8">
          <motion.div
            className="h-full bg-brand-600"
            animate={{ width: `${(completedCount / DEMO_STEPS.length) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>

        {errorMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-state-danger/30 bg-red-50 px-4 py-3 text-sm text-state-danger">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {errorMsg}
          </div>
        )}

        <div className="mt-8 space-y-3">
          {DEMO_STEPS.map((step, i) => {
            const status = statuses[i];
            const result = results[i];
            const Icon = STAGE_ICONS[step.stage] ?? Sparkles;
            return (
              <motion.div
                key={step.key}
                initial={{ opacity: 0.5 }}
                animate={{ opacity: status === "pending" ? 0.55 : 1 }}
                className={`rounded-xl border p-4 transition-colors ${
                  status === "error" ? "border-state-danger/40 bg-red-50/40" : status === "done" ? "border-brand-200 bg-white" : "border-charcoal-900/8 bg-white"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                      status === "done" ? "bg-brand-700 text-cream-50" : status === "running" ? "bg-brand-100 text-brand-700" : status === "error" ? "bg-state-danger/10 text-state-danger" : "bg-charcoal-900/6 text-charcoal-600/60"
                    }`}
                  >
                    {status === "running" ? <Loader2 className="h-5 w-5 animate-spin" /> : status === "done" ? <Check className="h-5 w-5" /> : status === "error" ? <AlertTriangle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
                        Stage {i + 1} · {step.stage}
                      </span>
                    </div>
                    <p className="font-display text-sm font-bold text-charcoal-900">{step.title}</p>
                    {result && (
                      <div className="mt-2">
                        <p className="text-sm font-semibold text-charcoal-800">{result.headline}</p>
                        <p className="mt-0.5 text-xs text-charcoal-600">{result.detail}</p>
                        {result.data && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {Object.entries(result.data).map(([k, v]) => (
                              <span key={k} className="rounded-md bg-cream-100 px-2.5 py-1 text-[11px] font-medium text-charcoal-700">
                                {k}: <span className="font-bold text-charcoal-900">{v}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-charcoal-600/70">
          Uses farmer@kisansetu.demo, buyer@kisansetu.demo, and admin@kisansetu.demo — password Demo@123. Safe to run repeatedly; each run
          creates a small amount of fresh demo data.
        </p>
      </div>
    </div>
  );
}
