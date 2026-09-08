import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sprout, ShoppingBag, Smartphone, Mail, ShieldCheck, CheckCircle2 } from "lucide-react";
import { BuyerType, REGIONS, UserRole } from "@kisansetu/shared";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../components/ui/Toast";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { authApi, ApiRequestError } from "../../lib/api";
import { cn } from "../../lib/cn";

const schema = z
  .object({
    name: z.string().min(2, "Enter your full name"),
    email: z.string().email("Enter a valid email"),
    phone: z.string().regex(/^[0-9]{10,13}$/, "Enter a valid phone number"),
    password: z.string().min(6, "At least 6 characters"),
    role: z.nativeEnum(UserRole),
    buyerType: z.nativeEnum(BuyerType).optional(),
    region: z.string().min(1, "Select a region"),
    village: z.string().optional(),
  })
  .refine((data) => data.role !== UserRole.BUYER || !!data.buyerType, {
    message: "Select a buyer type",
    path: ["buyerType"],
  });
type FormValues = z.infer<typeof schema>;

export function RegisterPage() {
  const { t } = useTranslation();
  const { register: doRegister } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { role?: "farmer" | "buyer" } };
  const [serverError, setServerError] = useState<string | null>(null);

  // OTP Verification state
  const [otpType, setOtpType] = useState<"phone" | "email">("phone");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [verifiedTarget, setVerifiedTarget] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { role: location.state?.role === "buyer" ? UserRole.BUYER : UserRole.FARMER },
  });

  const role = watch("role");
  const currentPhone = watch("phone");
  const currentEmail = watch("email");

  const currentTarget = otpType === "phone" ? currentPhone : currentEmail;
  const isTargetFilled = Boolean(currentTarget && currentTarget.trim().length >= (otpType === "phone" ? 10 : 5));

  // Reset verification if user changes their verified target
  if (isVerified && verifiedTarget && verifiedTarget !== currentTarget) {
    setIsVerified(false);
    setVerifiedTarget(null);
    setOtpSent(false);
    setOtpCode("");
    setDevCode(null);
    setIsConfigured(null);
  }

  async function handleSendOtp() {
    setOtpError(null);
    if (!isTargetFilled) {
      setOtpError(`Please enter a valid ${otpType === "phone" ? "phone number" : "email address"} above first.`);
      return;
    }
    setSendingOtp(true);
    try {
      const res = await authApi.sendOtp(currentTarget, otpType);
      setOtpSent(true);
      setIsConfigured(res.isConfigured);
      setDevCode(res.devCode ?? null);
      if (res.isConfigured) {
        push({
          kind: "success",
          title: `Verification code sent to ${currentTarget}`,
        });
      } else {
        push({
          kind: "info",
          title: `No external gateway in .env. Test OTP: ${res.devCode}`,
        });
      }
    } catch (err) {
      setOtpError(err instanceof ApiRequestError ? err.message : "Failed to send verification code. Try again.");
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleVerifyOtp() {
    setOtpError(null);
    if (!otpCode || otpCode.trim().length < 4) {
      setOtpError("Please enter the 6-digit OTP code.");
      return;
    }
    setVerifyingOtp(true);
    try {
      await authApi.verifyOtp(currentTarget, otpCode.trim());
      setIsVerified(true);
      setVerifiedTarget(currentTarget);
      setOtpError(null);
      push({ kind: "success", title: `${otpType === "phone" ? "Phone number" : "Email"} verified successfully!` });
    } catch (err) {
      setOtpError(err instanceof ApiRequestError ? err.message : "Invalid or expired OTP code.");
    } finally {
      setVerifyingOtp(false);
    }
  }

  async function onSubmit(values: FormValues) {
    setServerError(null);

    if (!isVerified || !verifiedTarget) {
      setServerError("Please verify either your phone number or email address with OTP before submitting.");
      return;
    }

    try {
      const user = await doRegister({
        ...values,
        languagePreference: "en",
        otpTarget: verifiedTarget,
        otpCode: otpCode,
      });
      push({ kind: "success", title: `Welcome to KisanSetu, ${user.name.split(" ")[0]}!` });
      navigate(user.role === UserRole.FARMER ? "/farmer" : user.role === UserRole.BUYER ? "/buyer" : "/admin");
    } catch (err) {
      setServerError(err instanceof ApiRequestError ? err.message : "Could not create your account. Please try again.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-100 px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 font-display text-lg font-extrabold text-brand-700">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-cream-50 text-sm">K</span>
          {t("common.appName")}
        </Link>

        <div className="card p-6">
          <h1 className="font-display text-xl font-bold text-charcoal-900">{t("auth.registerTitle")}</h1>
          <p className="mt-1 text-sm text-charcoal-600">{t("auth.registerSubtitle")}</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div>
              <label className="label">{t("auth.iAmA")}</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setValue("role", UserRole.FARMER)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold",
                    role === UserRole.FARMER ? "border-brand-600 bg-brand-50 text-brand-700" : "border-charcoal-900/10 text-charcoal-700"
                  )}
                >
                  <Sprout className="h-4 w-4" /> {t("auth.farmer")}
                </button>
                <button
                  type="button"
                  onClick={() => setValue("role", UserRole.BUYER)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold",
                    role === UserRole.BUYER ? "border-brand-600 bg-brand-50 text-brand-700" : "border-charcoal-900/10 text-charcoal-700"
                  )}
                >
                  <ShoppingBag className="h-4 w-4" /> {t("auth.buyer")}
                </button>
              </div>
            </div>

            <Input label={t("auth.name")} error={errors.name?.message} {...register("name")} />
            <Input label={t("auth.email")} type="email" error={errors.email?.message} {...register("email")} />
            <Input label={t("auth.phone")} type="tel" placeholder="9876543210" error={errors.phone?.message} {...register("phone")} />
            <Input label={t("auth.password")} type="password" error={errors.password?.message} {...register("password")} />

            {/* ── OTP Verification Section (Required) ── */}
            <div className="rounded-xl border border-charcoal-900/10 bg-cream-50/70 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-charcoal-900">
                  <ShieldCheck className="h-4 w-4 text-brand-600" />
                  <span>{t("auth.otp.verifyIdentity")}</span>
                </div>
                {isVerified && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {t("auth.otp.verified")}
                  </span>
                )}
              </div>

              {!isVerified ? (
                <>
                  <p className="text-xs text-charcoal-600">
                    {t("auth.otp.verifySubtitle")}
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOtpType("phone");
                        setOtpSent(false);
                        setOtpError(null);
                      }}
                      className={cn(
                        "flex items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-semibold transition-all",
                        otpType === "phone"
                          ? "border-brand-600 bg-white text-brand-700 shadow-sm"
                          : "border-charcoal-200 bg-transparent text-charcoal-600 hover:bg-white/50"
                      )}
                    >
                      <Smartphone className="h-3.5 w-3.5" /> {t("auth.otp.phoneOtp")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOtpType("email");
                        setOtpSent(false);
                        setOtpError(null);
                      }}
                      className={cn(
                        "flex items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-semibold transition-all",
                        otpType === "email"
                          ? "border-brand-600 bg-white text-brand-700 shadow-sm"
                          : "border-charcoal-200 bg-transparent text-charcoal-600 hover:bg-white/50"
                      )}
                    >
                      <Mail className="h-3.5 w-3.5" /> {t("auth.otp.emailOtp")}
                    </button>
                  </div>

                  {!otpSent ? (
                    <div className="space-y-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        fullWidth
                        onClick={handleSendOtp}
                        loading={sendingOtp}
                        disabled={!isTargetFilled}
                      >
                        {otpType === "phone" ? t("auth.otp.sendSmsOtp") : t("auth.otp.sendEmailOtp")}
                      </Button>
                      {!isTargetFilled && (
                        <p className="text-[11px] text-charcoal-500 text-center">
                          {t("auth.otp.fillPrompt")}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-charcoal-600">{t("auth.otp.enterCodeSentTo")}</span>
                        <span className="font-semibold text-charcoal-900 truncate max-w-[170px]">{currentTarget}</span>
                      </div>

                      {isConfigured ? (
                        <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200/80 rounded-lg p-2.5 font-medium">
                          {t("auth.otp.codeDispatched", { target: currentTarget })}
                        </p>
                      ) : (
                        <div className="text-xs text-amber-900 bg-amber-50 border border-amber-300/80 rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold flex items-center gap-1 text-[11px] uppercase tracking-wide text-amber-800">
                              ⚠️ {t("auth.otp.gatewayNotConfigured")}
                            </span>
                            {devCode && (
                              <button
                                type="button"
                                onClick={() => setOtpCode(devCode)}
                                className="px-2 py-0.5 text-[11px] font-bold bg-amber-200 text-amber-900 rounded hover:bg-amber-300 transition-colors"
                              >
                                {t("auth.otp.autoFillOtp")}
                              </button>
                            )}
                          </div>
                          <p className="text-charcoal-700">
                            {t("auth.otp.gatewayNote")}
                          </p>
                          <div className="font-mono text-base font-extrabold tracking-widest text-center py-1 bg-white rounded border border-amber-200 text-charcoal-900">
                            {devCode}
                          </div>
                          <p className="text-[10px] text-charcoal-500">
                            💡 {t("auth.otp.gmailSetupHint")}
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Input
                          placeholder={t("auth.otp.otpPlaceholder")}
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          maxLength={8}
                          className="text-center font-mono text-base tracking-widest"
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleVerifyOtp}
                          loading={verifyingOtp}
                          disabled={!otpCode}
                        >
                          {t("auth.otp.verifyBtn")}
                        </Button>
                      </div>

                      <div className="text-right">
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          disabled={sendingOtp}
                          className="text-xs text-brand-700 hover:underline font-medium"
                        >
                          {t("auth.otp.resendOtp")}
                        </button>
                      </div>
                    </div>
                  )}

                  {otpError && <p className="text-xs font-medium text-state-danger">{otpError}</p>}
                </>
              ) : (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-emerald-900">
                      {otpType === "phone" ? t("auth.otp.phoneVerified") : t("auth.otp.emailVerified")}
                    </p>
                    <p className="text-[11px] text-emerald-700">{verifiedTarget}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsVerified(false);
                      setVerifiedTarget(null);
                      setOtpSent(false);
                    }}
                    className="text-xs text-emerald-800 underline font-medium"
                  >
                    {t("auth.otp.changeTarget")}
                  </button>
                </div>
              )}
            </div>

            {role === UserRole.BUYER && (
              <Select label={t("auth.buyerType")} error={errors.buyerType?.message} {...register("buyerType")}>
                <option value="">Select...</option>
                {Object.values(BuyerType).map((bt) => (
                  <option key={bt} value={bt}>
                    {t(`auth.buyerTypes.${bt}`)}
                  </option>
                ))}
              </Select>
            )}

            <Select label={t("auth.region")} error={errors.region?.message} {...register("region")}>
              <option value="">Select...</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>

            <Input label={t("auth.village")} {...register("village")} />

            {serverError && <p className="text-sm font-medium text-state-danger">{serverError}</p>}
            <Button type="submit" fullWidth loading={isSubmitting}>
              {t("auth.registerCta")}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-charcoal-600">
            {t("auth.haveAccount")}{" "}
            <Link to="/login" className="font-semibold text-brand-700">
              {t("auth.loginCta")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
