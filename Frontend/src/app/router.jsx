import { lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import ProtectedRoleRoute from '../features/auth/presentation/ProtectedRoleRoute'
import RoleLandingRedirect from '../features/auth/presentation/RoleLandingRedirect'
import { userRoles } from '../features/auth/domain/roles'

const AccountPage = lazy(() => import('../pages/AccountPage'))
const AddressesPage = lazy(() => import('../pages/AddressesPage'))
const AdminPage = lazy(() => import('../pages/AdminPage'))
const CartPage = lazy(() => import('../features/cart/presentation/CartPage'))
const CheckoutPage = lazy(() => import('../features/checkout/presentation/CheckoutPage'))
const Checkout3DSCallbackPage = lazy(() => import('../features/checkout/presentation/Checkout3DSCallbackPage'))
const CustomerPage = lazy(() => import('../pages/CustomerPage'))
const FavoritesPage = lazy(() => import('../pages/FavoritesPage'))
const ForgotPasswordPage = lazy(() => import('../features/auth/presentation/ForgotPasswordPage'))
const HomePage = lazy(() => import('../pages/HomePage'))
const LoginPage = lazy(() => import('../features/auth/presentation/LoginPage'))
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'))
const OrderDetailPage = lazy(() => import('../features/orders/presentation/OrderDetailPage'))
const OrdersPage = lazy(() => import('../features/orders/presentation/OrdersPage'))
const PaymentMethodsPage = lazy(() => import('../pages/PaymentMethodsPage'))
const ProductDetailPage = lazy(() => import('../pages/ProductDetailPage'))
const ProductManagerPage = lazy(() => import('../pages/ProductManagerPage'))
const ProductsPage = lazy(() => import('../pages/ProductsPage'))
const RegisterPage = lazy(() => import('../features/auth/presentation/RegisterPage'))
const ResetPasswordPage = lazy(() => import('../features/auth/presentation/ResetPasswordPage'))
const SalesManagerPage = lazy(() => import('../pages/SalesManagerPage'))

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/account"
        element={(
          <ProtectedRoleRoute requiredRole={userRoles.customer}>
            <AccountPage />
          </ProtectedRoleRoute>
        )}
      />
      <Route
        path="/account/addresses"
        element={(
          <ProtectedRoleRoute requiredRole={userRoles.customer}>
            <AddressesPage />
          </ProtectedRoleRoute>
        )}
      />
      <Route
        path="/account/favorites"
        element={(
          <ProtectedRoleRoute requiredRole={userRoles.customer}>
            <FavoritesPage />
          </ProtectedRoleRoute>
        )}
      />
      <Route
        path="/account/orders"
        element={(
          <ProtectedRoleRoute requiredRole={userRoles.customer}>
            <OrdersPage />
          </ProtectedRoleRoute>
        )}
      />
      <Route
        path="/account/orders/:orderId"
        element={(
          <ProtectedRoleRoute requiredRole={userRoles.customer}>
            <OrderDetailPage />
          </ProtectedRoleRoute>
        )}
      />
      <Route
        path="/account/payment-methods"
        element={(
          <ProtectedRoleRoute requiredRole={userRoles.customer}>
            <PaymentMethodsPage />
          </ProtectedRoleRoute>
        )}
      />
      <Route
        path="/admin"
        element={(
          <ProtectedRoleRoute requiredRole={userRoles.admin}>
            <AdminPage />
          </ProtectedRoleRoute>
        )}
      />
      <Route path="/cart" element={<CartPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/checkout/3dscallback" element={<Checkout3DSCallbackPage />} />
      <Route
        path="/customer"
        element={(
          <ProtectedRoleRoute requiredRole={userRoles.customer}>
            <CustomerPage />
          </ProtectedRoleRoute>
        )}
      />
      <Route
        path="/sales-manager"
        element={(
          <ProtectedRoleRoute requiredRole={userRoles.salesManager}>
            <SalesManagerPage />
          </ProtectedRoleRoute>
        )}
      />
      <Route
        path="/product-manager"
        element={(
          <ProtectedRoleRoute requiredRole={userRoles.productManager}>
            <ProductManagerPage />
          </ProtectedRoleRoute>
        )}
      />
      <Route path="/dashboard" element={<RoleLandingRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/products" element={<ProductsPage />} />
      <Route path="/products/:slug" element={<ProductDetailPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgotpassword" element={<ForgotPasswordPage />} />
      <Route path="/resetpassword" element={<ResetPasswordPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
