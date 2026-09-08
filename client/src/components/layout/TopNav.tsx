import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Bell, Globe, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { changeLanguage } from "../../i18n";
import { notificationApi } from "../../lib/api";
import { cn } from "../../lib/cn";

interface NavItem {
  to: string;
  key: string;
  end?: boolean;
}

const LANGS: Array<{ code: "en" | "hi" | "mr"; label: string }> = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिंदी" },
  { code: "mr", label: "मराठी" },
];

export function TopNav({ items }: { items: NavItem[] }) {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => notificationApi.list(),
    refetchInterval: 10000,
    enabled: !!user,
  });
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <header className="sticky top-0 z-40 border-b border-charcoal-900/8 bg-cream-50/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-extrabold text-brand-700">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-cream-50 text-sm">K</span>
          {t("common.appName")}
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
                  isActive ? "bg-brand-50 text-brand-700" : "text-charcoal-700 hover:bg-charcoal-900/5"
                )
              }
            >
              {t(`nav.${item.key}`)}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="relative block">
            <button
              onClick={() => setLangOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-charcoal-700 hover:bg-charcoal-900/5"
            >
              <Globe className="h-4 w-4" />
              {i18n.language.toUpperCase()}
            </button>
            {langOpen && (
              <div className="absolute right-0 mt-1 w-32 rounded-lg border border-charcoal-900/8 bg-white py-1 shadow-panel z-50">
                {LANGS.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => {
                      changeLanguage(l.code);
                      setLangOpen(false);
                    }}
                    className={cn(
                      "block w-full px-3 py-1.5 text-left text-sm hover:bg-charcoal-900/5",
                      i18n.language === l.code ? "font-bold text-brand-700 bg-brand-50/50" : "text-charcoal-800"
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {user && (
            <NavLink to="/notifications" className="relative rounded-lg p-2 text-charcoal-700 hover:bg-charcoal-900/5">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white shadow-sm">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </NavLink>
          )}

          {user ? (
            <button
              onClick={() => {
                logout();
                navigate("/");
              }}
              className="hidden sm:flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-charcoal-700 hover:bg-charcoal-900/5"
            >
              <LogOut className="h-4 w-4" />
              {t("nav.logout")}
            </button>
          ) : (
            <Link to="/login" className="btn-primary hidden sm:inline-flex">
              {t("nav.login")}
            </Link>
          )}

          <button className="md:hidden rounded-lg p-2 text-charcoal-700 hover:bg-charcoal-900/5" onClick={() => setMobileOpen((v) => !v)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-charcoal-900/8 bg-white md:hidden">
          <div className="container-page flex flex-col py-2">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-semibold text-charcoal-700 hover:bg-charcoal-900/5"
              >
                {t(`nav.${item.key}`)}
              </NavLink>
            ))}
            <div className="flex items-center gap-2 px-3 py-2 border-t border-charcoal-100 my-1">
              <Globe className="h-4 w-4 text-charcoal-600" />
              <span className="text-xs font-semibold text-charcoal-600">{t("auth.language")}:</span>
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => {
                    changeLanguage(l.code);
                    setMobileOpen(false);
                  }}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs font-semibold transition-colors",
                    i18n.language === l.code ? "bg-brand-600 text-white" : "bg-charcoal-100 text-charcoal-700 hover:bg-charcoal-200"
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>
            {user ? (
              <button
                onClick={() => {
                  logout();
                  navigate("/");
                  setMobileOpen(false);
                }}
                className="mt-1 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-charcoal-700 hover:bg-charcoal-900/5"
              >
                {t("nav.logout")}
              </button>
            ) : (
              <Link to="/login" className="mt-1 rounded-lg px-3 py-2.5 text-sm font-semibold text-brand-700">
                {t("nav.login")}
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
