# Scientific Calculator

A fast, accurate, accessible scientific calculator built with vanilla HTML, CSS,
and JavaScript — no frameworks, no build step, no runtime dependencies.

## Features

### Basic operations
- Add, subtract, multiply, divide
- Decimals and negative numbers
- **Parentheses with correct operator precedence** (e.g. `2 + 3 * 4 = 14`)
- Chained operations and "continue from the last answer"
- All-clear (`AC`), delete (`DEL`), and toggle-sign (`±`)

### Scientific functions
- Square root (`√`), powers (`x^y`), reciprocal (`1/x`)
- Percent (`%`), factorial (`x!`)
- Logarithms: `log` (base 10) and `ln` (natural)
- Trigonometry: `sin`, `cos`, `tan` with a **DEG / RAD** toggle
- Constants: `π` and `e`

### Advanced
- **Calculation history** (click any entry to reload it) — persisted
- **Memory**: `MC`, `MR`, `M+`, `M-` with an on-screen `M` indicator
- **Light / dark theme** toggle
- **localStorage persistence** for history, memory, theme, and angle mode
- **Live result preview** as you type
- Full **keyboard support**

## Install / Run

No installation or server required.

```text
Open index.html in any modern browser.
```

On Windows you can simply double-click `index.html`, or from a terminal:

```powershell
Invoke-Item .\index.html
```

## Usage

Type or click to build an expression; the result previews live and is finalised
with `=`. Functions like `sin` insert `sin(` — close the parenthesis yourself or
let the preview wait until the expression is balanced.

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `0`–`9`, `.` | Digits / decimal |
| `+` `-` `*` `/` `^` | Operators |
| `(` `)` | Parentheses |
| `%` `!` | Percent / factorial |
| `Enter` or `=` | Evaluate |
| `Backspace` | Delete last token |
| `Escape` | All clear |

## Project structure

```text
Calculator/
├── index.html          # Markup: display, history panel, keypad (ARIA-labelled)
├── style.css           # Theme tokens, responsive grid, a11y focus states
├── js/
│   ├── engine.js       # Calculation engine — tokenizer + shunting-yard + RPN
│   ├── store.js        # State & localStorage persistence (memory/history/theme)
│   └── ui.js           # DOM controller wiring events to engine + store
├── tests/
│   ├── engine.test.js  # 52 unit tests for the engine (Node)
│   └── ui.smoke.js     # End-to-end UI interaction test (headless Chrome)
└── README.md
```

Business logic (`engine.js`) is fully decoupled from presentation (`ui.js`) and
state (`store.js`).

## Safety

User input is **never** passed to `eval()` or `Function()`. The engine tokenizes
the expression and rejects any character or name it does not recognise, then
evaluates via a shunting-yard parser. Division by zero, roots of negatives, logs
of non-positives, and malformed input all produce friendly errors instead of
crashing or returning `NaN`.

## Testing

```bash
# Engine unit tests (52 cases: arithmetic, precedence, scientific, errors)
node tests/engine.test.js

# UI interaction test — drives real button clicks in headless Chrome
node tests/ui.smoke.js
```

## Accessibility

- Every key is a real `<button>`, fully keyboard-navigable
- ARIA labels on all symbol buttons; `aria-live` on the result
- Visible focus rings (`:focus-visible`)
- Honors `prefers-contrast: more` and `prefers-reduced-motion`

## Scope note

This calculator implements the specification in `claude.md` (a basic + scientific
calculator). Items sometimes associated with "calculator platforms" but **not in
that spec** — matrices, vectors, complex numbers, graphing, calculus/equation
solving, financial functions, unit conversions, programmer/bitwise mode, and
statistics — are intentionally out of scope. They would each warrant their own
design and are easy to add later on top of the existing engine.
