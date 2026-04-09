export const userRoles = {
  admin: 'Admin',
  customer: 'Customer',
  salesManager: 'Sales Manager',
  productManager: 'Product Manager',
}

export function normalizeUserRole(role) {
  const normalizedRole = String(role || '').trim()

  if (normalizedRole === userRoles.admin) {
    return userRoles.admin
  }

  if (normalizedRole === userRoles.customer) {
    return userRoles.customer
  }

  if (normalizedRole === userRoles.salesManager) {
    return userRoles.salesManager
  }

  if (normalizedRole === userRoles.productManager) {
    return userRoles.productManager
  }

  return null
}

export function getRoleLandingPath(role) {
  const normalizedRole = normalizeUserRole(role)

  if (normalizedRole === userRoles.admin) {
    return '/api/restart'
  }

  if (normalizedRole === userRoles.customer) {
    return '/customer'
  }

  if (normalizedRole === userRoles.salesManager) {
    return '/sales-manager'
  }

  if (normalizedRole === userRoles.productManager) {
    return '/product-manager'
  }

  return '/'
}

export function getRoleLabel(role) {
  const normalizedRole = normalizeUserRole(role)

  if (normalizedRole) {
    return normalizedRole
  }

  const rawRole = String(role || '').trim()
  return rawRole || null
}

export function canAccessRole(role, requiredRole) {
  const normalizedRole = normalizeUserRole(role)
  const normalizedRequiredRole = normalizeUserRole(requiredRole)

  if (!normalizedRequiredRole) {
    return Boolean(normalizedRole)
  }

  if (normalizedRole === userRoles.admin) {
    return true
  }

  return normalizedRole === normalizedRequiredRole
}
