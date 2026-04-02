import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AccountPage from './pages/AccountPage'
import AddressesPage from './pages/AddressesPage'
import CartPage from './pages/CartPage'
import CheckoutPage from './pages/CheckoutPage'
import ProtectedRoleRoute from './components/ProtectedRoleRoute'
import RoleLandingRedirect from './components/RoleLandingRedirect'
import FavoritesPage from './pages/FavoritesPage'
import HomePage from './pages/HomePage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import OrdersPage from './pages/OrdersPage'
import ProductDetailPage from './pages/ProductDetailPage'
import ProductManagerPage from './pages/ProductManagerPage'
import ProductsPage from './pages/ProductsPage'
import RegisterPage from './pages/RegisterPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import SalesManagerPage from './pages/SalesManagerPage'
import CustomerPage from './pages/CustomerPage'
import { userRoles } from './lib/roles'

export default function App() {
  return (
    <BrowserRouter>
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
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
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
    </BrowserRouter>
  )
}
