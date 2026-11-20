import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/* Regression guard for the "everything went RTL" bug: the client used to
 * decide a side in JS ("contains an RTL character" -> dir="rtl") and stamp it
 * on coarse containers, so the forced side leaked into English text. Only
 * dir="auto" may ever be written, and only the browser may pick a side. */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const files = {
  'src/client/index.js': readFileSync(join(root, 'src/client/index.js'), 'utf8'),
  'lib/client.js': readFileSync(join(root, 'lib/client.js'), 'utf8'),
}

function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments (incl. CSS ones)
    .replace(/^\s*\/\/.*$/gm, '')       // line comments
}

for (const [file, raw] of Object.entries(files)) {
  const text = stripComments(raw)

  test(`${file}: never decides a direction in JS`, () => {
    assert.equal(/['"]rtl['"]/.test(text), false, 'has a quoted "rtl" literal')
    assert.equal(/['"]ltr['"]/.test(text), false, 'has a quoted "ltr" literal')
    assert.equal(/direction\s*:\s*rtl/.test(text), false, 'forces CSS direction: rtl')
  })

  test(`${file}: writes dir="auto" and keeps the native auto style layer`, () => {
    assert.match(text, /setAttribute\('dir',\s*'auto'\)/)
    assert.match(text, /unicode-bidi:\s*plaintext/)
    assert.match(text, /text-align:\s*start/)
  })
}

test('lib/client.js is one module-loader bundle carrying the same policy', () => {
  const bundle = files['lib/client.js']
  assert.equal((bundle.match(/__ModuleLoader__\.load\(/g) ?? []).length, 1)
  assert.match(bundle, /setAttribute\('dir',\s*'auto'\)/)
  // Code blocks stay LTR on purpose (unquoted CSS keyword, not a JS decision).
  assert.match(stripComments(bundle), /direction:\s*ltr/)
})
