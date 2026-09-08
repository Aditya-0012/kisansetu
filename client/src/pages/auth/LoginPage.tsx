import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sprout, ShoppingBag, ShieldCheck } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../components/ui/Toast";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { ApiRequestError } from "../../lib/api";
import { UserRole } from "@kisansetu/shared";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
type FormValues = z.infer<typeof schema>;

const DEMO_ACCOUNTS = [
  { email: "farmer@kisansetu.demo", key: "farmerDemo", label: "Farmer demo", icon: Sprout, role: UserRole.FARMER },
  { email: "buyer@kisansetu.demo", key: "buyerDemo", label: "Buyer demo", icon: ShoppingBag, role: UserRole.BUYER },
  { email: "admin@kisansetu.demo", key: "adminDemo", label: "Admin demo", icon: ShieldCheck, role: UserRole.ADMIN },
];

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [serverError, setServerError] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function afterLogin(role: UserRole) {
    const from = location.state?.from;
    if (from) return navigate(from);
    if (role === UserRole.FARMER) return navigate("/farmer");
    if (role === UserRole.BUYER) return navigate("/buyer");
    return navigate("/admin");
  }

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      const user = await login(values.email, values.password);
      push({ kind: "success", title: `Welcome back, ${user.name.split(" ")[0]}` });
      await afterLogin(user.role);
    } catch (err) {
      setServerError(err instanceof ApiRequestError ? err.message : "Could not log in. Please try again.");
    }
  }

  async function loginDemo(email: string) {
    setServerError(null);
    setDemoLoading(email);
    try {
      const user = await login(email, "Demo@123");
      push({ kind: "success", title: `Signed in as ${user.name.split(" ")[0]}` });
      await afterLogin(user.role);
    } catch (err) {
      setServerError(err instanceof ApiRequestError ? err.message : "Demo login failed.");
    } finally {
      setDemoLoading(null);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-100 px-4 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 font-display text-lg font-extrabold text-brand-700">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-cream-50 text-sm">K</span>
          {t("common.appName")}
        </Link>

        <div className="card p-6">
          <h1 className="font-display text-xl font-bold text-charcoal-900">{t("auth.loginTitle")}</h1>
          <p className="mt-1 text-sm text-charcoal-600">{t("auth.loginSubtitle")}</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <Input label={t("auth.email")} type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
            <Input label={t("auth.password")} type="password" autoComplete="current-password" error={errors.password?.message} {...register("password")} />
            {serverError && <p className="text-sm font-medium text-state-danger">{serverError}</p>}
            <Button type="submit" fullWidth loading={isSubmitting}>
              {t("auth.loginCta")}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-charcoal-600">
            {t("auth.noAccount")}{" "}
            <Link to="/register" className="font-semibold text-brand-700">
              {t("auth.registerCta")}
            </Link>
          </p>

          <div className="mt-6 border-t border-charcoal-900/8 pt-5">
            <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-charcoal-600">{t("auth.demoAccounts")}</p>
            <div className="grid grid-cols-3 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => loginDemo(acc.email)}
                  disabled={demoLoading !== null}
                  className="flex flex-col items-center gap-1.5 rounded-lg border border-charcoal-900/10 bg-white px-2 py-3 text-[11px] font-semibold text-charcoal-700 hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50"
                >
                  <acc.icon className="h-4 w-4 text-brand-600" />
                  {demoLoading === acc.email ? "..." : t(`auth.${acc.key}`, acc.label)}
                </button>
              ))}
            </div>
            <p className="mt-2.5 text-center text-[11px] text-charcoal-600/70">Password: Demo@123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
