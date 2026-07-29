import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { TableProvider } from './context/TableContext';
import { CartProvider } from './context/CartContext';
import { OrderProvider } from './context/OrderContext';
import { ToastProvider } from './context/ToastContext';
import { CustomerSessionProvider, useCustomerSession } from './context/CustomerSessionContext';
import CustomerLayout from './components/layout/CustomerLayout';

import WelcomeScreen from './pages/customer/WelcomeScreen';
import MenuScreen from './pages/customer/MenuScreen';
import FoodDetailsScreen from './pages/customer/FoodDetailsScreen';
import CartScreen from './pages/customer/CartScreen';
import OrderConfirmationScreen from './pages/customer/OrderConfirmationScreen';
import OrderTrackingScreen from './pages/customer/OrderTrackingScreen';
import ReportIssueScreen from './pages/customer/ReportIssueScreen';
import ReportSubmittedScreen from './pages/customer/ReportSubmittedScreen';
import ReportStatusScreen from './pages/customer/ReportStatusScreen';
import BillScreen from './pages/customer/BillScreen';
import PaymentScreen from './pages/customer/PaymentScreen';
import ThankYouScreen from './pages/customer/ThankYouScreen';
import KitchenDisplayScreen from './pages/kitchen/KitchenDisplayScreen';
import WaiterMainScreen from './pages/waiter/WaiterMainScreen';
import WaiterLoginScreen from './pages/waiter/WaiterLoginScreen';
import CounterLoginScreen from './pages/counter/CounterLoginScreen';
import CounterDashboardScreen from './pages/counter/CounterDashboardScreen';
import PendingBillsScreen from './pages/counter/PendingBillsScreen';
import PaymentProcessingScreen from './pages/counter/PaymentProcessingScreen';
import ReceiptPreviewScreen from './pages/counter/ReceiptPreviewScreen';
import DailyClosingScreen from './pages/counter/DailyClosingScreen';
import ProfileSettingsScreen from './pages/counter/ProfileSettingsScreen';
import ManagerMainScreen from './pages/manager/ManagerMainScreen';
import ManagerLoginScreen from './pages/manager/ManagerLoginScreen';
import PortalGatewayScreen from './pages/portal/PortalGatewayScreen';
import CustomerLoginScreen from './pages/customer/CustomerLoginScreen';
import FulfillmentSetupScreen from './pages/customer/FulfillmentSetupScreen';
import CustomerAccountScreen from './pages/customer/CustomerAccountScreen';
import CustomerOrdersScreen from './pages/customer/CustomerOrdersScreen';
import MealPassScreen from './pages/customer/MealPassScreen';

const CustomerRouteGate = ({ children }) => {
  const location = useLocation();
  const { isAuthenticated } = useCustomerSession();

  if (!isAuthenticated) {
    return <Navigate to="/customer/login" replace state={{ from: location.pathname }} />;
  }

  return children;
};

const RouteScrollManager = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

function App() {
  return (
    <Router>
      <RouteScrollManager />
      <ToastProvider>
        <CustomerSessionProvider>
          <TableProvider>
            <CartProvider>
              <OrderProvider>
              <Routes>
                {/* Central System Login & Navigation Portal Route */}
                <Route path="/login" element={<PortalGatewayScreen />} />
                <Route path="/portal" element={<PortalGatewayScreen />} />

                {/* Manager Executive Dashboard Route */}
                <Route path="/manager/login" element={<ManagerLoginScreen />} />
                <Route path="/manager" element={<ManagerMainScreen />} />

                {/* Kitchen Staff KDS Route */}
                <Route path="/kitchen/*" element={<KitchenDisplayScreen />} />

                {/* Waiter Mobile App Route */}
                <Route path="/waiter/login" element={<WaiterLoginScreen />} />
                <Route path="/waiter" element={<WaiterMainScreen />} />

                {/* Counter POS Routes */}
                <Route path="/counter/login" element={<CounterLoginScreen />} />
                <Route path="/counter" element={<CounterDashboardScreen />} />
                <Route path="/counter/pending-bills" element={<PendingBillsScreen />} />
                <Route path="/counter/payment" element={<PaymentProcessingScreen />} />
                <Route path="/counter/receipt" element={<ReceiptPreviewScreen />} />
                <Route path="/counter/daily-closing" element={<DailyClosingScreen />} />
                <Route path="/counter/profile" element={<ProfileSettingsScreen />} />

                <Route path="/customer/login" element={<CustomerLoginScreen />} />

                {/* Customer Routes Wrapped in Customer Layout */}
                <Route
                  path="/*"
                  element={
                    <CustomerRouteGate>
                      <CustomerLayout>
                        <Routes>
                          <Route path="/" element={<WelcomeScreen />} />
                          <Route path="/delivery-details" element={<FulfillmentSetupScreen />} />
                          <Route path="/account" element={<CustomerAccountScreen />} />
                          <Route path="/orders" element={<CustomerOrdersScreen />} />
                          <Route path="/meal-pass" element={<MealPassScreen />} />
                          <Route path="/menu" element={<MenuScreen />} />
                          <Route path="/menu/:id" element={<FoodDetailsScreen />} />
                          <Route path="/cart" element={<CartScreen />} />
                          <Route path="/order-confirmation" element={<OrderConfirmationScreen />} />
                          <Route path="/order-tracking" element={<OrderTrackingScreen />} />
                          <Route path="/report-issue" element={<ReportIssueScreen />} />
                          <Route path="/report-submitted" element={<ReportSubmittedScreen />} />
                          <Route path="/report-status" element={<ReportStatusScreen />} />
                          <Route path="/bill" element={<BillScreen />} />
                          <Route path="/payment" element={<PaymentScreen />} />
                          <Route path="/success" element={<ThankYouScreen />} />
                          <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                      </CustomerLayout>
                    </CustomerRouteGate>
                  }
                />
              </Routes>
              </OrderProvider>
            </CartProvider>
          </TableProvider>
        </CustomerSessionProvider>
      </ToastProvider>
    </Router>
  );
}

export default App;
