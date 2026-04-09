export const userRoles = {
  customer: 'Customer',
  salesManager: 'Sales Manager',
  productManager: 'Product Manager',
}

export function normalizeUserRole(role) {
  const normalizedRole = String(role || '').trim()

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
  return normalizeUserRole(role)
}
