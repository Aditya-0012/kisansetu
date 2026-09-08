import { Navigate, Route, Routes } from "react-router-dom";
import { UserRole } from "@kisansetu/shared";
import { useAuth } from "./hooks/useAuth";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { FarmerLayout } from "./components/layout/FarmerLayout";
import { BuyerLayout } from "./components/layout/BuyerLayout";
import { AdminLayout } from "./components/layout/AdminLayout";
import { PageLoader } from "./components/layout/PageLoader";

import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { DemoModePage } from "./pages/DemoModePage";

import { FarmerHomePage } from "./pages/farmer/FarmerHomePage";
import { FarmerDemandPage } from "./pages/farmer/FarmerDemandPage";
import { FarmerListProducePage } from "./pages/farmer/FarmerListProducePage";
import { FarmerOrdersPage } from "./pages/farmer/FarmerOrdersPage";
import { FarmerProfilePage } from "./pages/farmer/FarmerProfilePage";

import { BuyerMarketplacePage } from "./pages/buyer/BuyerMarketplacePage";
import { BuyerFindSupplyPage } from "./pages/buyer/BuyerFindSupplyPage";
import { BuyerOrdersPage } from "./pages/buyer/BuyerOrdersPage";
import { BuyerOrderDetailPage } from "./pages/buyer/BuyerOrderDetailPage";
import { ListingDetailPage } from "./pages/buyer/ListingDetailPage";

import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage";
import { AdminIntelligenceCenterPage } from "./pages/admin/AdminIntelligenceCenterPage";
import { AdminSmsLogsPage } from "./pages/admin/AdminSmsLogsPage";
import { AdminAuditLogPage } from "./pages/admin/AdminAuditLogPage";

function HomeRedirect() {
  const { user, status } = useAuth();
  if (status === "loading") return <PageLoader />;
  if (!user) return <LandingPage />;
  if (user.role === UserRole.FARMER) return <Navigate to="/farmer" replace />;
  if (user.role === UserRole.BUYER) return <Navigate to="/buyer" replace />;
  return <Navigate to="/admin" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/demo-mode" element={<DemoModePage />} />

      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <NotificationsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/farmer"
        element={
          <ProtectedRoute roles={[UserRole.FARMER]}>
            <FarmerLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<FarmerHomePage />} />
        <Route path="demand" element={<FarmerDemandPage />} />
        <Route path="list-produce" element={<FarmerListProducePage />} />
        <Route path="orders" element={<FarmerOrdersPage />} />
        <Route path="profile" element={<FarmerProfilePage />} />
      </Route>

      <Route
        path="/buyer"
        element={
          <ProtectedRoute roles={[UserRole.BUYER]}>
            <BuyerLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<BuyerMarketplacePage />} />
        <Route path="listings/:id" element={<ListingDetailPage />} />
        <Route path="find-supply" element={<BuyerFindSupplyPage />} />
        <Route path="orders" element={<BuyerOrdersPage />} />
        <Route path="orders/:id" element={<BuyerOrderDetailPage />} />
      </Route>

      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={[UserRole.ADMIN]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="intelligence" element={<AdminIntelligenceCenterPage />} />
        <Route path="sms-logs" element={<AdminSmsLogsPage />} />
        <Route path="audit-log" element={<AdminAuditLogPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
