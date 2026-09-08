import { Link, NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LayoutDashboard, Radar, MessageSquareText, ScrollText, LogOut } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { cn } from "../../lib/cn";

interface SidebarNavItem {
  readonly to: string;
  readonly icon: typeof LayoutDashboard;
  readonly labelKey: string;
  readonly end?: boolean;
}

const ITEMS: readonly SidebarNavItem[] = [
  { to: "/admin", icon: LayoutDashboard, labelKey: "nav.dashboard", end: true },
  { to: "/admin/intelligence", icon: Radar, labelKey: "nav.intelligence" },
  { to: "/admin/sms-logs", icon: MessageSquareText, labelKey: "admin.smsLogs" },
  { to: "/admin/audit-log", icon: ScrollText, labelKey: "admin.auditLog" },
];

export function Sidebar() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <aside className="hidden md:flex md:w-60 md:flex-shrink-0 md:flex-col border-r border-charcoal-900/8 bg-white">
      <Link to="/admin" className="flex items-center gap-2 px-5 py-5 font-display text-lg font-extrabold text-brand-700">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-cream-50 text-sm">K</span>
        {t("common.appName")}
      </Link>
      <nav className="flex-1 space-y-1 px-3">
        {ITEMS.map(({ to, icon: Icon, labelKey, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                isActive ? "bg-brand-50 text-brand-700" : "text-charcoal-700 hover:bg-charcoal-900/5"
              )
            }
          >
            <Icon className="h-4.5 w-4.5" />
            {t(labelKey)}
          </NavLink>
        ))}
      </nav>
      <button
        onClick={() => {
          logout();
          navigate("/");
        }}
        className="mx-3 mb-5 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-charcoal-700 hover:bg-charcoal-900/5"
      >
        <LogOut className="h-4.5 w-4.5" />
        {t("nav.logout")}
      </button>
    </aside>
  );
}
