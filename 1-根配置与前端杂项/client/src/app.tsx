import React, { useEffect } from 'react';
import { Route, Routes, Navigate, useNavigate } from 'react-router-dom';

import LoginPage from './pages/Login/LoginPage';
import RegisterPage from './pages/Register/RegisterPage';
import ApplyRunnerPage from './pages/ApplyRunner/ApplyRunnerPage';

import HomePage from './pages/Home/HomePage';
import CreateOrderPage from './pages/CreateOrder/CreateOrderPage';
import OrdersPage from './pages/OrdersPage/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage/OrderDetailPage';
import NotificationsPage from './pages/Notifications/NotificationsPage';
import EarningsPage from './pages/EarningsPage/EarningsPage';
import PaymentPage from './pages/Payment/PaymentPage';
import MockPayPage from './pages/Payment/MockPayPage';
import PaymentAccountPage from './pages/PaymentAccount/PaymentAccountPage';
import RefundSessionPage from './pages/RefundSession/RefundSessionPage';
import SettlementListPage from './pages/Settlement/SettlementListPage';
import SettlementDetailPage from './pages/Settlement/SettlementDetailPage';

import BuyerHomePage from './pages/BuyerHome/BuyerHomePage';
import BuyerOrdersPage from './pages/BuyerOrders/BuyerOrdersPage';

import BuyerLayout from './components/BuyerLayout';
import RunnerLayout from './components/RunnerLayout';
import BuyerProfilePage from './pages/BuyerProfile/BuyerProfilePage';
import RunnerHallPage from './pages/RunnerHall/RunnerHallPage';
import RunnerOrdersPage from './pages/RunnerOrders/RunnerOrdersPage';
import RunnerProfilePage from './pages/RunnerProfile/RunnerProfilePage';
import SettingsPage from './pages/Settings/SettingsPage';
import SupportChatPage from './pages/SupportChat/SupportChatPage';
import RunnerBlockedPage from './pages/RunnerBlockedPage/RunnerBlockedPage';

import AdminLoginPage from './pages/admin/AdminLogin/AdminLoginPage';
import AdminLayout from './components/AdminLayout';
import AdminDashboardPage from './pages/admin/Dashboard/AdminDashboardPage';
import AdminRefundsPage from './pages/admin/Refunds/AdminRefundsPage';
import RefundDetailPage from './pages/admin/Refunds/RefundDetailPage';
import AdminRefundSessionPage from './pages/admin/Refunds/AdminRefundSessionPage';
import AdminOrdersPage from './pages/admin/Orders/AdminOrdersPage';
import AdminUsersPage from './pages/admin/Users/AdminUsersPage';
import AdminEarningsPage from './pages/admin/Earnings/AdminEarningsPage';
import PaymentConfigPage from './pages/admin/PaymentConfig/PaymentConfigPage';
import AdminRunnerReviewsPage from './pages/admin/RunnerReviews/AdminRunnerReviewsPage';
import AdminNotificationsPage from './pages/admin/Notifications/AdminNotificationsPage';
import AdminPaymentVerificationPage from './pages/admin/PaymentVerification/AdminPaymentVerificationPage';
import AdminFundsPage from './pages/admin/Funds/AdminFundsPage';
import FundTransactionsPage from './pages/admin/FundTransactions/FundTransactionsPage';
import AdminSettlementDetailPage from './pages/admin/SettlementDetail/AdminSettlementDetailPage';
import AdminSupportListPage from './pages/admin/Support/AdminSupportListPage';

import { useUser, getLastRole } from './store/userStore';

const RootRedirect: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    const lastRole = getLastRole();
    if (lastRole === 'runner' && user.isRunner && user.runnerStatus === 'approved') {
      navigate('/runner/hall', { replace: true });
    } else {
      navigate('/buyer/home', { replace: true });
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-muted-foreground text-sm">加载中...</div>
    </div>
  );
};

const RoutesComponent = () => {
  return (
    <Routes>
      {/* 独立页面（无 tab） */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/apply-runner" element={<ApplyRunnerPage />} />
      <Route path="/runner/blocked" element={<RunnerBlockedPage />} />
      <Route path="/buyer/support/:id" element={<SupportChatPage />} />
      <Route path="/runner/support/:id" element={<SupportChatPage />} />
      <Route path="/runner/settlement/:id" element={<SettlementDetailPage />} />

      {/* 买家端 */}
      <Route path="/buyer" element={<BuyerLayout />}>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<BuyerHomePage />} />
        <Route path="orders" element={<BuyerOrdersPage />} />
        <Route path="profile" element={<BuyerProfilePage />} />
        <Route path="create-order" element={<CreateOrderPage />} />
        <Route path="order/:id" element={<OrderDetailPage />} />
        <Route path="payment/:orderId" element={<PaymentPage />} />
        <Route path="payment/mock/:payNo" element={<MockPayPage />} />
        <Route path="payment-account" element={<PaymentAccountPage />} />
        <Route path="refund-session/:id" element={<RefundSessionPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* 接单员端（RunnerLayout 内部做拦截） */}
      <Route path="/runner" element={<RunnerLayout />}>
        <Route index element={<Navigate to="hall" replace />} />
        <Route path="hall" element={<RunnerHallPage />} />
        <Route path="orders" element={<RunnerOrdersPage />} />
        <Route path="profile" element={<RunnerProfilePage />} />
        <Route path="order/:id" element={<OrderDetailPage />} />
        <Route path="settlements" element={<SettlementListPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="earnings" element={<EarningsPage />} />
        <Route path="payment-account" element={<PaymentAccountPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* 管理员端 */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="payment-verification" element={<AdminPaymentVerificationPage />} />
        <Route path="runner-reviews" element={<AdminRunnerReviewsPage />} />
        <Route path="notifications" element={<AdminNotificationsPage />} />
        <Route path="refunds" element={<AdminRefundsPage />} />
        <Route path="refunds/:id" element={<RefundDetailPage />} />
        <Route path="refund-session/:id" element={<AdminRefundSessionPage />} />
        <Route path="orders" element={<AdminOrdersPage />} />
        <Route path="settlements/:id" element={<AdminSettlementDetailPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="funds" element={<AdminFundsPage />} />
        <Route path="earnings" element={<AdminEarningsPage />} />
        <Route path="support" element={<AdminSupportListPage />} />
        <Route path="payment-config" element={<PaymentConfigPage />} />
        <Route path="transactions" element={<FundTransactionsPage />} />
      </Route>

      {/* 根路由重定向 */}
      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<Navigate to="/buyer/home" replace />} />
    </Routes>
  );
};

export default RoutesComponent;
