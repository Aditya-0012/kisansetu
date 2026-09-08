import { Outlet } from "react-router-dom";
import { TopNav } from "./TopNav";
import { BottomNav } from "./BottomNav";

const NAV_ITEMS = [
  { to: "/farmer", key: "home", end: true },
  { to: "/farmer/demand", key: "demand" },
  { to: "/farmer/list-produce", key: "listProduce" },
  { to: "/farmer/orders", key: "orders" },
];

export function FarmerLayout() {
  return (
    <div className="min-h-screen bg-cream-100">
      <TopNav items={NAV_ITEMS} />
      <main className="container-page py-6 pb-24 sm:pb-10">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
