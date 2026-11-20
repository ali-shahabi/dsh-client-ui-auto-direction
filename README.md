# dsh-client-ui-auto-direction

Sets **text direction automatically** in the DSH Web GUI. Each text block (and the
composer) resolves its own direction from its **first strong character**: Persian /
Arabic / Hebrew come out RTL, English comes out LTR, in the same transcript.

Font is handled by the **separate** [`dsh-client-ui-vazirmatn`](https://github.com/ali-shahabi/dsh-client-ui-vazirmatn) plugin.

## What it does

| Where | Behaviour |
|---|---|
| Every text-bearing block (`p, li, ul, ol, h1–h6, blockquote, dd, dt, td, th, figcaption, summary`) inside a message | `dir="auto"` + `unicode-bidi: plaintext; text-align: start` |
| Message roots (`[data-chat-flow-kind]`) and class-suffixed wrappers (`_body/_bubble/_userStack/_text/_content`) | `dir="auto"` fallback for wrappers holding a bare text node |
| Chat **input** (Lexical editable `[data-composer-input]`) | `dir="auto"` |
| New / streamed messages and streamed **text** | `MutationObserver` (`childList` + `characterData`) stamps `dir="auto"` on added/late-filled blocks |
| Code blocks | forced LTR (`unicode-bidi: isolate; direction: ltr`) |

The plugin only ever writes **`dir="auto"`** — never `rtl` or `ltr` — so no forced
side can leak into English content:

- `dir="auto"` makes the browser pick the direction from the element's own first
  strong character (HTML § 3.2.6.4).
- `unicode-bidi: plaintext` resolves each **paragraph** independently (and ignores
  an inherited direction), so a message mixing English and Persian paragraphs
  orders every paragraph correctly.
- `text-align: start` then follows the resolved direction, so Persian bubbles are
  right-aligned and English bubbles left-aligned with no script detection of ours.

> Earlier versions used a "contains an RTL character" regex and stamped an explicit
> `dir="rtl"` on matching containers. Because a container's `textContent` includes
> all descendants (and app-shell classes such as `*_body` matched the same suffix
> selectors), that `dir` was inherited by everything below it — English text went
> RTL and the whole GUI flipped. Detection was removed in favour of native auto.

### Why each block needs its own `dir="auto"` (2026-11-04)

A single `dir="auto"` on a message wrapper is resolved from the **first strong
character anywhere inside it** — including a Latin tool label, a `Step 2/3`
status line, a timestamp, a filename or a code chip that sits above the text.
When that first strong character is Latin, the wrapper resolves **LTR and every
Persian block inherits it**: list markers stay on the left, headings flush left,
lines left-aligned with a ragged right edge. That is exactly what a
"Persian renders left-to-right" report looks like, even though the plugin is
loaded and `dir="auto"` was written.

Stamping every block instead makes each paragraph decide for itself, so:

- Persian blocks resolve RTL — markers move to the right (the `<li>` direction
  owns the marker side), the first word lands at the right edge, lines are flush
  right;
- English blocks in the same message still resolve LTR;
- a wrapper that flips direction cannot drag its children with it.

`unicode-bidi: plaintext` is likewise set on the blocks, not just the wrapper,
because that property is not inherited either.

## Install

```sh
git clone https://github.com/ali-shahabi/dsh-client-ui-auto-direction.git
dsh plugin --profile desktop add link:$PWD/dsh-client-ui-auto-direction
dsh plugin --profile web     add link:$PWD/dsh-client-ui-auto-direction   # only if you use the `dsh web` CLI
```

The **desktop** profile is the one the DeepSeek Harness app boots.

## Build / test

```sh
node auto-direction/scripts/build-client.js        # write lib/client.js
node auto-direction/scripts/build-client.js --check
node --test auto-direction/tests/invariants.test.js
```

## Disable

`dsh plugin --profile desktop remove dsh-client-ui-auto-direction` → restart.

## License

Apache-2.0 — see [LICENSE](./LICENSE).