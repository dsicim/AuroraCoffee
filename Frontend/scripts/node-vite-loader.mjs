export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context)
  } catch (error) {
    const isMissingExtension =
      error?.code === 'ERR_MODULE_NOT_FOUND' &&
      (specifier.startsWith('./') || specifier.startsWith('../')) &&
      !specifier.match(/\.[a-z0-9]+$/i)

    if (!isMissingExtension) {
      throw error
    }

    return nextResolve(`${specifier}.js`, context)
  }
}
