import { Home, TrendingUp, PackagePlus, ClipboardList, User } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/cn";

// Farmer's primary navigation — spec calls for a mobile-first bottom nav
// since most farmers will use this on a phone in the field.
interface NavItem {
  readonly to: string;
  readonly icon: typeof Home;
  readonly key: string;
  readonly end?: boolean;
}

const ITEMS: readonly NavItem[] = [
  { to: "/farmer", icon: Home, key: "home", end: true },
  { to: "/farmer/demand", icon: TrendingUp, key: "demand" },
  { to: "/farmer/list-produce", icon: PackagePlus, key: "listProduce" },
  { to: "/farmer/orders", icon: ClipboardList, key: "orders" },
  { to: "/farmer/profile", icon: User, key: "profile" },
];

export function BottomNav() {
  const { t } = useTranslation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-charcoal-900/8 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)] sm:hidden">
      <div className="flex items-stretch justify-around">
        {ITEMS.map(({ to, icon: Icon, key, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                isActive ? "text-brand-700" : "text-charcoal-600"
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.4 : 2} />
                <span>{t(`nav.${key}`)}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
