type TrialOptions = {
  startIfMissing?: boolean
}

export type TrialState = {
  startedAt: number | null
  expiresAt: number | null
  isActive: boolean
  isExpired: boolean
  isLicensed: boolean
  daysRemaining: number
}

const trialKey = 'wowmd.trial.v1'
const licenseKey = 'wowmd.license.v1'
const trialLengthMs = 14 * 24 * 60 * 60 * 1000

export function createTrialState(options: TrialOptions = {}): TrialState {
  const now = Date.now()
  const existing = localStorage.getItem(trialKey)
  let startedAt = existing ? Number(existing) : null
  const isLicensed = hasLocalLicense()

  if (!startedAt && options.startIfMissing) {
    startedAt = now
    localStorage.setItem(trialKey, String(startedAt))
  }

  const expiresAt = startedAt ? startedAt + trialLengthMs : null
  const isActive = Boolean(!isLicensed && expiresAt && expiresAt > now)
  const isExpired = Boolean(!isLicensed && expiresAt && expiresAt <= now)
  const daysRemaining = expiresAt
    ? Math.max(0, Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000)))
    : 14

  return {
    startedAt,
    expiresAt,
    isLicensed,
    isActive,
    isExpired,
    daysRemaining,
  }
}

type Translate = (key: string) => string

export function getLicenseSummary(trial: TrialState, t: Translate = (key) => key) {
  if (trial.isLicensed) {
    return {
      label: t('licensed'),
      detail: t('lifetime'),
      canOpenUserFiles: true,
      canExport: true,
      canSaveAnnotations: true,
    }
  }

  if (trial.isActive) {
    return {
      label: t('trialActive'),
      detail: `${trial.daysRemaining} ${trial.daysRemaining === 1 ? t('day') : t('days')}`,
      canOpenUserFiles: true,
      canExport: true,
      canSaveAnnotations: true,
    }
  }

  if (trial.isExpired) {
    return {
      label: t('trialExpired'),
      detail: t('licenseRequired'),
      canOpenUserFiles: false,
      canExport: false,
      canSaveAnnotations: false,
    }
  }

  return {
    label: t('trialReady'),
    detail: `14 ${t('days')}`,
    canOpenUserFiles: true,
    canExport: true,
    canSaveAnnotations: true,
  }
}

export function activateLocalLicense(key: string) {
  const normalized = key.trim().toUpperCase()
  if (!/^WOWMD-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalized)) {
    return {
      ok: false,
      message: 'invalidLicense',
    }
  }

  localStorage.setItem(
    licenseKey,
    JSON.stringify({
      plan: 'lifetime',
      activatedAt: new Date().toISOString(),
      keyHash: btoa(normalized).slice(0, 16),
    }),
  )

  return {
    ok: true,
    message: 'activated',
  }
}

function hasLocalLicense() {
  const raw = localStorage.getItem(licenseKey)
  if (!raw) return false

  try {
    const parsed = JSON.parse(raw)
    return parsed?.plan === 'lifetime'
  } catch {
    return false
  }
}
