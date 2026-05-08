export const userRoles = {
  admin: 'Admin',
  customer: 'Customer',
  salesManager: 'Sales Manager',
  productManager: 'Product Manager',
}

export const roleAccessLevels = [
  { role: userRoles.customer, label: 'Customer Home', to: '/customer' },
  { role: userRoles.productManager, label: 'Product Manager', to: '/product-manager' },
  { role: userRoles.salesManager, label: 'Sales Manager', to: '/sales-manager' },
  { role: userRoles.admin, label: 'Admin', to: '/admin' },
]

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
    return '/admin'
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

export function getAccessibleRoleLevels(role) {
  const normalizedRole = normalizeUserRole(role)

  if (normalizedRole === userRoles.admin) {
    return roleAccessLevels
  }

  if (normalizedRole === userRoles.productManager) {
    return roleAccessLevels.filter(({ role: accessRole }) => accessRole === userRoles.productManager)
  }

  if (normalizedRole === userRoles.salesManager) {
    return roleAccessLevels.filter(({ role: accessRole }) => accessRole === userRoles.salesManager)
  }

  if (normalizedRole === userRoles.customer) {
    return roleAccessLevels.filter(({ role: accessRole }) => accessRole === userRoles.customer)
  }

  return []
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
  const normalizedRequiredRole = normalizeUserRole(requiredRole)

  if (!normalizedRequiredRole) {
    return Boolean(normalizeUserRole(role))
  }

  return getAccessibleRoleLevels(role).some(({ role: accessRole }) => (
    accessRole === normalizedRequiredRole
  ))
}

export function getRolePopupPath(role) {
  const normalizedRole = normalizeUserRole(role)

  if (normalizedRole === userRoles.admin) {
    return '/api/restart'
  }

  return null
}

export function openRolePopup(role) {
  const popupPath = getRolePopupPath(role)

  if (!popupPath) {
    return false
  }

  const popupWindow = window.open(popupPath, '_blank', 'noopener,noreferrer')

  if (popupWindow) {
    popupWindow.focus()
    return true
  }

  return false
}
