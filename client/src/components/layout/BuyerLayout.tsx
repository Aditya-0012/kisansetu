import { Outlet } from "react-router-dom";
import { TopNav } from "./TopNav";

const NAV_ITEMS = [
  { to: "/buyer", key: "marketplace", end: true },
  { to: "/buyer/find-supply", key: "findSupply" },
  { to: "/buyer/orders", key: "orders" },
];

export function BuyerLayout() {
  return (
    <div className="min-h-screen bg-cream-100">
      <TopNav items={NAV_ITEMS} />
      <main className="container-page py-6">
        <Outlet />
      </main>
    </div>
  );
}
