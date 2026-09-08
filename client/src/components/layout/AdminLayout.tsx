import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";

const ADMIN_NAV_ITEMS = [
  { to: "/admin", key: "dashboard", end: true },
  { to: "/admin/intelligence", key: "intelligence" },
];

export function AdminLayout() {
  return (
    <div className="min-h-screen bg-cream-100 flex flex-col md:flex-row">
      <div className="md:hidden">
        <TopNav items={ADMIN_NAV_ITEMS} />
      </div>
      <Sidebar />
      <main className="flex-1 overflow-x-hidden px-4 py-6 sm:px-8">
        <Outlet />
      </main>
    </div>
  );
}
