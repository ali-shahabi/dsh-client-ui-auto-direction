import { claimAutoDirApply, releaseAutoDirApply } from './apply-guard.js'

export const inject = []

/* Direction policy - "auto", never a forced side:
 *  - The ONLY dir value this plugin ever writes is `auto`, which makes the
 *    browser resolve each element's direction from its own first strong
 *    character (HTML 3.2.6.4). It can never drag English text right-to-left,
 *    because there is no `rtl` side to inherit.
 *  - Every text-bearing BLOCK is stamped, not just one wrapper: a wrapper's
 *    dir="auto" is decided by the first strong character *anywhere inside it*
 *    (a Latin timestamp, a collapsed tool row, an English filename), and it is
 *    inherited by everything below. Stamping each block makes a Persian
 *    paragraph RTL and an English paragraph LTR inside the same message, and it
 *    is what moves list markers to the right in RTL (`<li>` direction owns the
 *    marker side).
 *  - `unicode-bidi: plaintext` + `text-align: start` then let alignment follow
 *    the resolved direction, so Persian is flush right and English flush left
 *    with no script detection of our own.
 *
 * Real DSH DOM anchors (verified against the installed app bundle):
 *  Composer editable:  div[data-composer-input][role=textbox]  (Lexical)
 *  Message column:     [data-chat-flow]
 *  Per-message item:   [data-chat-flow-kind="user"|"response"|...]
 *  Assistant body:     class *_body > (p | ul > li | ol > li | h1..h6 | ...)
 * CSS-module class names carry per-build hash prefixes but STABLE suffixes
 * (_body/_bubble/_userStack/_text/_content), which stay as a fallback for
 * wrappers that hold a bare text node and no block children.
 */

const BLOCK_SELECTOR = [
  '[class$="_body"]',
  '[class$="_bubble"]',
  '[class$="_userStack"]',
  '[class$="_text"]',
  '[class$="_content"]',
  'p',
  'li',
  'ul',
  'ol',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'dd',
  'dt',
  'td',
  'th',
  'figcaption',
  'summary',
].join(', ')

const ROOT_SELECTOR = '[data-chat-flow-kind], [data-composer-input]'

const CODE_SELECTOR = 'pre, code, [class$="_code"]'

const CSS = `
/* Auto bidirectional text: each block resolves its own base direction from its
 * own first strong character (dir="auto"), and unicode-bidi:plaintext resolves
 * every bidi paragraph the same way, so an RTL sibling or ancestor cannot flip
 * English text. No explicit rtl/ltr is ever written. */
[data-chat-flow] :is(p, li, ul, ol, h1, h2, h3, h4, h5, h6, blockquote, dd, dt, td, th, figcaption, summary),
[data-chat-flow] [class$="_body"],
[data-chat-flow] [class$="_bubble"],
[data-chat-flow] [class$="_userStack"],
[data-chat-flow] [class$="_text"],
[data-chat-flow] [class$="_content"],
[data-composer-input] {
  unicode-bidi: plaintext;
  text-align: start;
}
/* Keep code blocks left-to-right */
[data-chat-flow] pre,
[data-chat-flow] code,
[data-chat-flow] [class$="_code"] {
  unicode-bidi: isolate;
  direction: ltr;
  text-align: left;
}
`

function inCode(el) {
  try {
    if (typeof el.closest !== 'function') return false
    return el.closest(CODE_SELECTOR) !== null
  } catch {
    return false
  }
}

function setAutoDir(el) {
  if (!el || typeof el.setAttribute !== 'function') return
  if (inCode(el)) return
  try {
    if (el.getAttribute && el.getAttribute('dir') === 'auto') return
    el.setAttribute('dir', 'auto')
  } catch {}
}

function matches(el, selector) {
  try {
    return typeof el.matches === 'function' && el.matches(selector)
  } catch {
    return false
  }
}

/* Stamp dir="auto" on the message roots and on every text-bearing block inside
 * `root`. Idempotent and side-free: a block that already says auto is left
 * alone, and nothing is ever set to rtl/ltr. */
function scan(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return
  if (matches(root, ROOT_SELECTOR)) setAutoDir(root)
  if (matches(root, BLOCK_SELECTOR)) setAutoDir(root)
  for (const el of root.querySelectorAll(ROOT_SELECTOR)) setAutoDir(el)
  for (const el of root.querySelectorAll(BLOCK_SELECTOR)) setAutoDir(el)
}

export function apply(ctx) {
  if (!claimAutoDirApply()) return
  ctx.effect(() => releaseAutoDirApply, 'auto-direction: apply claim')

  const run = () => {
    try {
      if (typeof document === 'undefined' || typeof document.head === 'undefined') return
      // 1) Style layer: native auto-direction for chat text + composer.
      if (document.head.querySelector('style[data-dsh-auto-direction-styles]') === null) {
        const tag = document.createElement('style')
        tag.setAttribute('data-dsh-auto-direction-styles', '')
        tag.textContent = CSS
        document.head.appendChild(tag)
      }
      // 2) Composer: dir=auto on the Lexical editable (first strong character).
      setAutoDir(document.querySelector('[data-composer-input]'))
      // 3) Existing messages.
      scan(document)
    } catch {}
  }

  // Watch for newly mounted / streamed messages; new nodes get dir="auto".
  // characterData is included because streaming markdown often fills an
  // existing block instead of adding a new one.
  try {
    if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined' && document.body) {
      const obs = new MutationObserver((records) => {
        try {
          for (const rec of records) {
            if (rec.type === 'characterData') {
              const parent = rec.target && rec.target.parentElement
              if (parent) scan(parent)
              continue
            }
            for (const node of rec.addedNodes) {
              if (node && node.nodeType === 1) scan(node)
            }
          }
        } catch {}
      })
      obs.observe(document.body, { childList: true, subtree: true, characterData: true })
      ctx.effect(() => () => { try { obs.disconnect() } catch {} }, 'auto-direction: observer')
    }
  } catch {}

  try { run() } catch {}
  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true })
    }
  } catch {}

  try {
    ctx.locale?.register('auto-direction', {
      zh: { 'entry.label': 'Auto Direction' },
      en: { 'entry.label': 'Auto Direction' },
    })
  } catch {}
}
