export const DEFAULTS = Object.freeze({ enabled: true })

export function readConfigField(field, fallback) {
  if (field === undefined) return fallback
  if (typeof field === 'object' && field !== null && typeof field.get === 'function') return field.get()
  return field
}

export function effectiveConfig(config) {
  return {
    enabled: readConfigField(config?.enabled, DEFAULTS.enabled) !== false,
  }
}
