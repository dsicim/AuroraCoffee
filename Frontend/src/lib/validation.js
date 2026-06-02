import { getCityPostalPrefix, isKnownTurkishCity } from './address.js'

export const emailRegex = /^([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x22([^\x0d\x22\x5c\x80-\xff]|\x5c[\x00-\x7f])*\x22)(\x2e([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x22([^\x0d\x22\x5c\x80-\xff]|\x5c[\x00-\x7f])*\x22))*\x40([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x5b([^\x0d\x5b-\x5d\x80-\xff]|\x5c[\x00-\x7f])*\x5d)(\x2e([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x5b([^\x0d\x5b-\x5d\x80-\xff]|\x5c[\x00-\x7f])*\x5d))*$/u // eslint-disable-line no-control-regex
export const postalCodeRegex = /^\d{5}$/
export const identityDocumentTypes = {
  tcKimlik: 'tcKimlik',
  ykKimlik: 'residencePermit',
  taxId: 'taxId',
  foreignPassport: 'foreignPassport',
}

export function sanitizeTurkishIdentityNumber(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 11)
}

export function sanitizePassportNumber(value) {
  return String(value || '')
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase()
    .slice(0, 9)
}

export function sanitizeTaxIdentityNumber(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 10)
}

export function sanitizeIdentityDocumentNumber(value) {
  return String(value || '')
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase()
    .slice(0, 11)
}

export function validateTurkishIdentityNumber(value) {
  const identityNumber = sanitizeTurkishIdentityNumber(value)

  if (!identityNumber) {
    return { s: false, e: 'Turkish ID Number is required' }
  }

  if (identityNumber.length !== 11) {
    return { s: false, e: 'Turkish ID Number must be exactly 11 digits' }
  }

  if (identityNumber[0] === '0') {
    return { s: false, e: 'Turkish ID Number cannot start with 0' }
  }

  if (/^(\d)\1+$/.test(identityNumber)) {
    return { s: false, e: 'Enter a valid Turkish ID Number' }
  }

  const digits = identityNumber.split('').map(Number)
  const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8]
  const evenSum = digits[1] + digits[3] + digits[5] + digits[7]
  const expectedTenthDigit = (((oddSum * 7) - evenSum) % 10 + 10) % 10
  const expectedEleventhDigit = digits.slice(0, 10).reduce((total, digit) => total + digit, 0) % 10

  if (digits[9] !== expectedTenthDigit || digits[10] !== expectedEleventhDigit) {
    return { s: false, e: 'Enter a valid Turkish ID Number' }
  }

  return { s: true, value: identityNumber }
}

export function validatePassportNumber(value) {
  const passportNumber = sanitizePassportNumber(value)

  if (!passportNumber) {
    return { s: false, e: 'Passport number is required' }
  }

  if (passportNumber.length > 9) {
    return { s: false, e: 'Passport number must be 9 characters or fewer' }
  }

  return { s: true, value: passportNumber }
}

export function validateTaxIdentityNumber(value) {
  const taxId = sanitizeTaxIdentityNumber(value)

  if (!taxId) {
    return { s: true, value: '' }
  }

  if (taxId.length !== 10) {
    return { s: false, e: 'Tax ID must be exactly 10 digits' }
  }

  if (!taxIDType(taxId).s) {
    return { s: false, e: 'Enter a valid Tax ID' }
  }

  return { s: true, value: taxId }
}

export function validateIdentityDocument(value, type = identityDocumentTypes.tcKimlik) {
  if (type === identityDocumentTypes.foreignPassport) {
    return validatePassportNumber(value)
  }

  return type === identityDocumentTypes.taxId
    ? validateTaxIdentityNumber(value)
    : validateTurkishIdentityNumber(value)
}

export function inferIdentityDocumentType(value) {
  const identityNumber = sanitizeIdentityDocumentNumber(value)

  if (!identityNumber) {
    return null
  }

  if (/^\d{11}$/.test(identityNumber)) {
    return identityDocumentTypes.tcKimlik
  }

  if (/^\d{10}$/.test(identityNumber)) {
    return identityDocumentTypes.taxId
  }

  return identityDocumentTypes.foreignPassport
}

export function taxIDType(taxId) {
    taxId = String(taxId || '').trim().toUpperCase();
    if (taxId === "11111111111") return { s: false, t: "Turkish ID", e: "Invalid Number." };
    if (!taxId) return { s: true, t: "None", e: "Tax ID is empty" };
    if (taxId.length > 11) return { s: false, t: "unknown", e: "Tax ID must be 11 characters or fewer" };
    if (!/^[A-Z0-9]+$/.test(taxId)) return { s: false, t: "unknown", e: "Invalid Tax ID format" };

    const mightBeTC = taxId.length === 11 && /^\d+$/.test(taxId);
    const mightBeVKN = taxId.length === 10 && /^\d+$/.test(taxId);

    if (mightBeTC) {
        const digits = taxId.split('').map(Number)
        const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8]
        const evenSum = digits[1] + digits[3] + digits[5] + digits[7]
        const expectedTenthDigit = (((oddSum * 7) - evenSum) % 10 + 10) % 10
        const expectedEleventhDigit = digits.slice(0, 10).reduce((total, digit) => total + digit, 0) % 10
        const isForeigner = taxId[0] === "9";
        if (digits[0] === 0) return { s: false, t: isForeigner ? "Turkish Foreigner Resident ID" : "Turkish ID", e: "Invalid Number" };
        if (digits[9] !== expectedTenthDigit) return { s: false, t: isForeigner ? "Turkish Foreigner Resident ID" : "Turkish ID", e: "Invalid Number" };
        if (digits[10] !== expectedEleventhDigit) return { s: false, t: isForeigner ? "Turkish Foreigner Resident ID" : "Turkish ID", e: "Invalid Number" };
        return { s: true, t: isForeigner ? "Turkish Foreigner Resident ID" : "Turkish ID" };
    }
    else if (mightBeVKN) {
        if (!isValidVKN(taxId)) return { s: false, t: "Turkish Corporate Tax ID", e: "Invalid Number" };
        return { s: true, t: "Turkish Corporate Tax ID" };
    }
    else if (taxId.length <= 9) {
        return { s: true, t: "Passport Number" };
    }
    else return { s: false, t: "unknown", e: "Invalid Tax ID format" };
}

function isValidVKN(taxId) {
  const digits = taxId.split('').map(Number)
  let sum = 0

  for (let i = 0; i < 9; i += 1) {
    const tmp = (digits[i] + (9 - i)) % 10

    if (tmp === 0) {
      continue
    }

    let product = (tmp * (2 ** (9 - i))) % 9

    if (product === 0) {
      product = 9
    }

    sum += product
  }

  const expectedTenthDigit = (10 - (sum % 10)) % 10
  return digits[9] === expectedTenthDigit
}

export function validateIdentityDocumentAuto(value) {
  const identityNumber = sanitizeIdentityDocumentNumber(value)

  if (!identityNumber) {
    return { s: false, e: 'Identity number is required' }
  }

  const type = inferIdentityDocumentType(identityNumber)

  if (!type) {
    return { s: false, e: 'Enter a valid identity number' }
  }

  if (type === identityDocumentTypes.tcKimlik) {
    const validation = validateTurkishIdentityNumber(identityNumber)
    return validation.s ? { ...validation, type } : validation
  }

  if (type === identityDocumentTypes.taxId) {
    const validation = validateTaxIdentityNumber(identityNumber)
    return validation.s ? { ...validation, type } : validation
  }

  return { s: true, value: identityNumber, type }
}

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

export function validateCardExpiry(expiry, now = new Date()) {
  const normalizedExpiry = String(expiry || '').trim()
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(normalizedExpiry)

  if (!match) {
    return { s: false, e: 'Expiry must be in MM/YY format' }
  }

  const expiryMonth = Number(match[1])
  const expiryYear = 2000 + Number(match[2])
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  if (expiryYear < currentYear || (expiryYear === currentYear && expiryMonth < currentMonth)) {
    return { s: false, e: 'Expiry date cannot be in the past' }
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
