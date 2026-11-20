import { mountOnce } from './mount-once.js'
import { effectiveConfig } from './config.js'

export { effectiveConfig, DEFAULTS } from './config.js'

export const name = 'dsh-client-ui-auto-direction'
export const inject = ['systemPrompt']

export const apply = mountOnce('dsh-client-ui-auto-direction', applyImpl)

function applyImpl(ctx, config) {
  const tag = '[auto-dir]'
  const log = (level, msg) => {
    try {
      const logger = ctx.logger
      if (logger !== undefined && typeof logger[level] === 'function') logger[level](msg)
    } catch {}
  }

  let disposeSection
  let applied

  const sync = () => {
    const next = effectiveConfig(config)
    const key = String(next.enabled)
    if (applied === key) return
    applied = key
    if (disposeSection !== undefined) { disposeSection(); disposeSection = undefined }
    if (!next.enabled) {
      log('info', `${tag} disabled`)
      return
    }
    disposeSection = ctx.systemPrompt.section({
      name: 'plugin:auto-direction',
      order: 199,
      text: 'Auto-direction is active: every message block and the composer resolve their own direction (dir="auto") - Persian/Arabic/Hebrew render RTL, English renders LTR.',
    })
    log('info', `${tag} active`)
  }

  try { ctx.on?.('loader/volatile-update', sync) } catch {}
  sync()
}
