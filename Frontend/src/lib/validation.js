import { getCityPostalPrefix, isKnownTurkishCity } from './address'

export const emailRegex = /^([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x22([^\x0d\x22\x5c\x80-\xff]|\x5c[\x00-\x7f])*\x22)(\x2e([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x22([^\x0d\x22\x5c\x80-\xff]|\x5c[\x00-\x7f])*\x22))*\x40([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x5b([^\x0d\x5b-\x5d\x80-\xff]|\x5c[\x00-\x7f])*\x5d)(\x2e([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x5b([^\x0d\x5b-\x5d\x80-\xff]|\x5c[\x00-\x7f])*\x5d))*$/u // eslint-disable-line no-control-regex
export const postalCodeRegex = /^\d{5}$/

export function validateEmail(email) {
  const normalizedEmail = email.trim()

  if (!normalizedEmail) {
    return { s: false, e: 'Email address is required' }
  }

  if (normalizedEmail.length > 255) {
    return { s: false, e: 'Email address must not exceed 255 characters' }
  }

  if (!emailRegex.test(normalizedEmail)) {
    return { s: false, e: 'Enter a valid email address' }
  }

  return { s: true }
}

export function validatePostalCode(postalCode) {
  const normalizedPostalCode = postalCode.trim()

  if (!normalizedPostalCode) {
    return { s: false, e: 'Postal code is required' }
  }

  if (!postalCodeRegex.test(normalizedPostalCode)) {
    return { s: false, e: 'Postal code must be exactly 5 digits' }
  }

  return { s: true }
}

export function validateTurkishCity(city) {
  const normalizedCity = city.trim()

  if (!normalizedCity) {
    return { s: false, e: 'City is required' }
  }

  if (!isKnownTurkishCity(normalizedCity)) {
    return { s: false, e: 'Select a valid city from the list' }
  }

  return { s: true }
}

export function validateCityPostalCode(city, postalCode) {
  const cityValidation = validateTurkishCity(city)

  if (!cityValidation.s) {
    return cityValidation
  }

  const postalCodeValidation = validatePostalCode(postalCode)

  if (!postalCodeValidation.s) {
    return postalCodeValidation
  }

  const postalPrefix = getCityPostalPrefix(city)

  if (!postalPrefix) {
    return { s: false, e: 'Select a valid city from the list' }
  }

  if (!postalCode.trim().startsWith(postalPrefix)) {
    return {
      s: false,
      e: `Postal code must start with ${postalPrefix} for ${city.trim()}`,
    }
  }

  return { s: true }
}

export function validatePassword(password, ids = []) {
  if (password.length < 8) {
    return { s: false, e: 'Password must be at least 8 characters long' }
  }

  if (password.length > 255) {
    return { s: false, e: 'Password must not exceed 255 characters' }
  }

  if (!/\p{Ll}/u.test(password)) {
    return { s: false, e: 'Password must contain at least one lowercase letter' }
  }

  if (!/\p{Lu}/u.test(password)) {
    return { s: false, e: 'Password must contain at least one uppercase letter' }
  }

  if (!/(?:\p{Nd}|[^\p{L}\p{N}\s])/u.test(password)) {
    return { s: false, e: 'Password must contain at least one number or symbol' }
  }

  const normalizedPassword = password.toLowerCase().replace(/\s+/g, '')

  for (const id of ids) {
    const normalizedId = String(id || '')
      .toLowerCase()
      .replace(/\s+/g, '')

    if (!normalizedId) {
      continue
    }

    if (normalizedId.length > 5) {
      for (let index = 0; index <= normalizedId.length - 5; index += 1) {
        const candidate = normalizedId.substring(index, index + 5)

        if (normalizedPassword.includes(candidate)) {
          return {
            s: false,
            e: 'Password must not contain parts of your email or name',
          }
        }
      }
    } else if (normalizedPassword.includes(normalizedId)) {
      return {
        s: false,
        e: 'Password must not contain parts of your email or name',
      }
    }
  }

  return { s: true }
}
