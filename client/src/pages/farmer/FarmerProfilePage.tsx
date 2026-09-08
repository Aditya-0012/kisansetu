import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Star, LogOut, Globe, MapPin, Phone, Mail } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { ratingApi } from "../../lib/api";
import { Card } from "../../components/ui/Card";
import { changeLanguage } from "../../i18n";
import { cn } from "../../lib/cn";

const LANGS: Array<{ code: "en" | "hi" | "mr"; label: string }> = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिंदी" },
  { code: "mr", label: "मराठी" },
];

export function FarmerProfilePage() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const ratingQuery = useQuery({
    queryKey: ["ratings", "user", user?.id],
    queryFn: () => ratingApi.forUser(user!.id),
    enabled: !!user,
  });

  if (!user) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-700 font-display text-2xl font-bold text-cream-50">
          {user.name.charAt(0)}
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-charcoal-900">{user.name}</h1>
          <p className="flex items-center gap-1 text-sm text-charcoal-600">
            <Star className="h-3.5 w-3.5 fill-earth-wheat text-earth-wheat" />
            {ratingQuery.data ? ratingQuery.data.average.toFixed(1) : "—"} {t("farmer.averageRating")}
          </p>
        </div>
      </div>

      <Card className="space-y-3">
        <div className="flex items-center gap-3 text-sm text-charcoal-800">
          <Mail className="h-4 w-4 text-charcoal-600" /> {user.email}
        </div>
        <div className="flex items-center gap-3 text-sm text-charcoal-800">
          <Phone className="h-4 w-4 text-charcoal-600" /> {user.phone}
        </div>
        <div className="flex items-center gap-3 text-sm text-charcoal-800">
          <MapPin className="h-4 w-4 text-charcoal-600" /> {user.region ?? "—"}{user.village ? `, ${user.village}` : ""}
        </div>
      </Card>

      <Card>
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-charcoal-900">
          <Globe className="h-4 w-4" /> {t("auth.language")}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => changeLanguage(l.code)}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm font-semibold",
                i18n.language === l.code ? "border-brand-600 bg-brand-50 text-brand-700" : "border-charcoal-900/10 text-charcoal-700"
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      </Card>

      <button
        onClick={() => {
          logout();
          navigate("/");
        }}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-state-danger/30 py-3 text-sm font-semibold text-state-danger"
      >
        <LogOut className="h-4 w-4" /> {t("nav.logout")}
      </button>
    </div>
  );
}
