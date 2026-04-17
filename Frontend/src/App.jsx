import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import ProtectedRoleRoute from './components/ProtectedRoleRoute'
import RoleLandingRedirect from './components/RoleLandingRedirect'
import { userRoles } from './lib/roles'

const AccountPage = lazy(() => import('./pages/AccountPage'))
const AddressesPage = lazy(() => import('./pages/AddressesPage'))
const CartPage = lazy(() => import('./pages/CartPage'))
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'))
const Checkout3DSCallbackPage = lazy(() => import('./pages/Checkout3DSCallbackPage'))
const CustomerPage = lazy(() => import('./pages/CustomerPage'))
const FavoritesPage = lazy(() => import('./pages/FavoritesPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const HomePage = lazy(() => import('./pages/HomePage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const OrderDetailPage = lazy(() => import('./pages/OrderDetailPage'))
const OrdersPage = lazy(() => import('./pages/OrdersPage'))
const PaymentMethodsPage = lazy(() => import('./pages/PaymentMethodsPage'))
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'))
const ProductManagerPage = lazy(() => import('./pages/ProductManagerPage'))
const ProductsPage = lazy(() => import('./pages/ProductsPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const SalesManagerPage = lazy(() => import('./pages/SalesManagerPage'))

function RouteFallback() {
  return (
    <div className="aurora-route-fallback" role="status" aria-live="polite">
      Loading Aurora Coffee
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
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
      </Suspense>
    </BrowserRouter>
  )
}
