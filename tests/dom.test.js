import test from 'node:test'
import assert from 'node:assert/strict'

/* Behavioural check on a minimal fake DOM: apply() must stamp dir="auto" on the
 * chat blocks + composer, must never write rtl/ltr anywhere, and must not
 * double-inject its stylesheet. This catches a silently-throwing scan(), which
 * the plugin's try/catch would otherwise swallow. */

function matchesOne(el, part) {
  const m = part.match(/^([a-zA-Z][a-zA-Z0-9]*)?(?:\[([a-zA-Z-]+)(?:(\$?=)"([^"]*)")?\])?$/)
  if (m === null || part === '') return false
  const [, tag, attr, op, value] = m
  if (tag !== undefined && el.tagName !== tag.toUpperCase()) return false
  if (attr !== undefined) {
    if (!Object.prototype.hasOwnProperty.call(el.attributes, attr)) return false
    const actual = String(el.attributes[attr])
    if (op === '$=' && !actual.endsWith(value)) return false
    if (op === '=' && actual !== value) return false
  }
  return true
}

function matches(el, selector) {
  return selector.split(',').some((part) => matchesOne(el, part.trim()))
}

function el(tag, attrs = {}, children = []) {
  return {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    attributes: { ...attrs },
    children,
    setAttribute(name, value) { this.attributes[name] = String(value) },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null
    },
    appendChild(child) { this.children.push(child); return child },
    matches(selector) { return matches(this, selector) },
    querySelectorAll(selector) {
      const out = []
      const walk = (node) => {
        for (const child of node.children ?? []) {
          if (matches(child, selector)) out.push(child)
          walk(child)
        }
      }
      walk(this)
      return out
    },
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null },
  }
}

function fakeDocument() {
  const heading = el('h2')
  const listItem = el('li')
  const list = el('ul', {}, [listItem])
  const paragraph = el('p')
  const persianBody = el('div', { class: 'chat_msg_body' }, [list, heading, paragraph])
  const englishBody = el('div', { class: 'chat_msg_body' })
  const flow = el('div', { 'data-chat-flow': '' }, [persianBody, englishBody])
  const composer = el('div', { 'data-composer-input': '', role: 'textbox' })
  const head = el('head')
  const body = el('body', {}, [flow, composer])
  return {
    persianBody,
    englishBody,
    list,
    listItem,
    heading,
    paragraph,
    composer,
    head,
    document: {
      readyState: 'complete',
      head,
      body,
      createElement: (tag) => el(tag),
      querySelector(selector) {
        if (matches(head, selector)) return head
        const inHead = head.querySelector(selector)
        if (inHead !== null) return inHead
        if (matches(body, selector)) return body
        return body.querySelector(selector)
      },
      querySelectorAll(selector) {
        return [...head.querySelectorAll(selector), ...body.querySelectorAll(selector)]
      },
      addEventListener() {},
    },
  }
}

const { apply } = await import('../src/client/index.js')

test('apply() stamps dir="auto" on chat blocks and composer, never rtl/ltr', () => {
  const dom = fakeDocument()
  globalThis.document = dom.document
  const ctx = { effect: () => {}, locale: { register() {} } }
  apply(ctx)

  assert.equal(dom.composer.getAttribute('dir'), 'auto', 'composer should be dir=auto')
  assert.equal(dom.persianBody.getAttribute('dir'), 'auto', 'persian block should be dir=auto')
  assert.equal(dom.englishBody.getAttribute('dir'), 'auto', 'english block should be dir=auto')

  // Every text-bearing block carries its own dir="auto": one dir="auto" on a
  // message wrapper is decided by the first strong character *anywhere* inside
  // it, so a Latin tool label above the Persian text would pin the whole
  // message to LTR. Blocks must not depend on an ancestor.
  for (const [label, node] of Object.entries({
    list: dom.list,
    listItem: dom.listItem,
    heading: dom.heading,
    paragraph: dom.paragraph,
  })) {
    assert.equal(node.getAttribute('dir'), 'auto', `${label} should carry dir="auto"`)
  }

  const styles = dom.head.querySelectorAll('style')
  assert.equal(styles.length, 1, 'exactly one style tag injected')
  assert.match(styles[0].textContent, /unicode-bidi:\s*plaintext/)
  assert.equal(styles[0].getAttribute('data-dsh-auto-direction-styles'), '')

  const dirs = [dom.composer, dom.persianBody, dom.englishBody].map((node) => node.getAttribute('dir'))
  assert.equal(dirs.some((dir) => dir === 'rtl' || dir === 'ltr'), false, 'no explicit side written')

  // The claim guard makes a remount/duplicate apply a no-op: the stylesheet is
  // never injected twice and no direction is ever re-decided.
  apply(ctx)
  assert.equal(dom.head.querySelectorAll('style').length, 1, 'no double injection')
})
