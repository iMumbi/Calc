/**
 * ui.js — Presentation / controller layer.
 *
 * Wires DOM events to the Engine (calculation) and Store (state/persistence).
 * Holds only transient editing state (the in-progress expression); everything
 * durable lives in the Store. Uses an "expression / formula" input model: each
 * key appends a token to a single expression string that the Engine evaluates,
 * which is what makes operator precedence and parentheses work naturally.
 */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    const el = {
      expression: document.getElementById("expression"),
      result: document.getElementById("result"),
      buttons: document.querySelector(".buttons"),
      memoryIndicator: document.getElementById("memoryIndicator"),
      angleToggle: document.getElementById("angleToggle"),
      themeToggle: document.getElementById("themeToggle"),
      historyToggle: document.getElementById("historyToggle"),
      historyPanel: document.getElementById("historyPanel"),
      historyList: document.getElementById("historyList"),
      historyEmpty: document.getElementById("historyEmpty"),
      historyClear: document.getElementById("historyClear"),
    };

    // --- transient editing state ---
    let expr = "";
    let lastResult = 0;
    let justEvaluated = false;
    let errored = false;
    let errorMsg = "";

    const angleMode = () => Store.getState().angleMode;

    // --- formatting helpers ------------------------------------------------

    function formatNumber(n) {
      if (!Number.isFinite(n)) return "Error";
      if (Object.is(n, -0)) n = 0;
      // Trim floating-point noise to 12 significant digits, then normalise.
      return String(parseFloat(n.toPrecision(12)));
    }

    // Turn a numeric result into a substring safe to inject into an expression.
    function numToExpr(n) {
      const s = formatNumber(n);
      return n < 0 ? `(${s})` : s;
    }

    // Auto-close unclosed groups so function buttons (which insert "sin(" etc.)
    // evaluate naturally without the user remembering the closing ")".
    // Only appends when parens are net-open; an extra ")" is left to error.
    function balanceParens(s) {
      const opens = (s.match(/\(/g) || []).length;
      const closes = (s.match(/\)/g) || []).length;
      const missing = opens - closes;
      return missing > 0 ? s + ")".repeat(missing) : s;
    }

    // Internal token form -> human-readable display form.
    function pretty(s) {
      return s
        .replace(/sqrt\(/g, "√(")
        .replace(/\*/g, "×")
        .replace(/\//g, "÷")
        .replace(/-/g, "−");
    }

    // --- rendering ---------------------------------------------------------

    function render() {
      if (errored) {
        el.expression.textContent = pretty(expr);
        el.result.textContent = errorMsg;
        el.result.classList.add("error");
        el.result.classList.remove("preview");
        return;
      }
      el.result.classList.remove("error");

      if (expr === "") {
        el.expression.textContent = "";
        el.result.textContent = "0";
        el.result.classList.remove("preview");
        return;
      }

      el.expression.textContent = pretty(expr);

      if (justEvaluated) {
        el.result.textContent = formatNumber(lastResult);
        el.result.classList.remove("preview");
      } else {
        // Live preview of the in-progress expression (muted).
        try {
          const v = Engine.evaluate(balanceParens(expr), { angleMode: angleMode() });
          el.result.textContent = formatNumber(v);
          el.result.classList.add("preview");
        } catch {
          el.result.textContent = "";
          el.result.classList.remove("preview");
        }
      }
    }

    // --- core actions ------------------------------------------------------

    const FUNCTION_TOKENS = ["sin(", "cos(", "tan(", "ln(", "log(", "sqrt("];
    const CONTINUATION = new Set(["+", "-", "*", "/", "^", "!", "%"]);

    function append(value) {
      if (errored) {
        expr = "";
        errored = false;
      }
      if (justEvaluated) {
        // Continue from the result for operators; start fresh otherwise.
        expr = CONTINUATION.has(value) ? numToExpr(lastResult) : "";
        justEvaluated = false;
      }
      expr += value;
      render();
    }

    function equals() {
      if (expr === "") return;
      const balanced = balanceParens(expr);
      try {
        const v = Engine.evaluate(balanced, { angleMode: angleMode() });
        Store.addHistory(balanced, formatNumber(v));
        expr = balanced; // reflect the completed (closed) expression on screen
        lastResult = v;
        justEvaluated = true;
        errored = false;
        render();
      } catch (e) {
        errored = true;
        errorMsg = e instanceof Engine.CalcError ? e.message : "Error";
        render();
      }
    }

    function clearAll() {
      expr = "";
      justEvaluated = false;
      errored = false;
      render();
    }

    function deleteLast() {
      if (justEvaluated || errored) {
        clearAll();
        return;
      }
      // Remove a whole function token if the expression ends with one.
      const fnToken = FUNCTION_TOKENS.find((t) => expr.endsWith(t));
      expr = fnToken ? expr.slice(0, -fnToken.length) : expr.slice(0, -1);
      render();
    }

    function negate() {
      if (errored) return;
      if (justEvaluated) {
        expr = numToExpr(lastResult);
        justEvaluated = false;
      }
      const m = expr.match(/(\d*\.?\d+)$/);
      if (!m) return;
      const num = m[1];
      const before = expr.slice(0, expr.length - num.length);
      const core = before.slice(0, -1);
      const isUnaryMinus = before.endsWith("-") && (core === "" || /[(*/+^-]$/.test(core));
      expr = isUnaryMinus ? core + num : before + "-" + num;
      render();
    }

    function reciprocal() {
      if (errored) clearAll();
      if (justEvaluated) {
        expr = numToExpr(lastResult);
        justEvaluated = false;
      }
      if (expr === "") return;
      expr = `1/(${expr})`;
      render();
    }

    function insertAnswer() {
      append(numToExpr(lastResult));
    }

    // Evaluate the current editing value for memory operations.
    function currentValue() {
      if (expr !== "") {
        try {
          return Engine.evaluate(balanceParens(expr), { angleMode: angleMode() });
        } catch {
          /* fall through to last result */
        }
      }
      return lastResult || 0;
    }

    function handleMemory(mem) {
      switch (mem) {
        case "MC":
          Store.memoryClear();
          break;
        case "MR":
          append(numToExpr(Store.memoryRecall()));
          break;
        case "M+":
          Store.memoryAdd(currentValue());
          break;
        case "M-":
          Store.memorySubtract(currentValue());
          break;
      }
    }

    // --- store-derived UI sync --------------------------------------------

    function syncFromStore(state) {
      // Memory indicator
      el.memoryIndicator.hidden = state.memory === 0;
      // Angle mode
      el.angleToggle.textContent = state.angleMode;
      // Theme
      document.documentElement.setAttribute("data-theme", state.theme);
      el.themeToggle.setAttribute("aria-pressed", String(state.theme === "light"));
      // History
      renderHistory(state.history);
    }

    function renderHistory(history) {
      el.historyList.innerHTML = "";
      el.historyEmpty.hidden = history.length > 0;
      history.forEach((item) => {
        const li = document.createElement("li");
        li.className = "history-item";
        li.setAttribute("role", "listitem");

        const exprBtn = document.createElement("button");
        exprBtn.type = "button";
        exprBtn.className = "history-load";
        exprBtn.innerHTML = `<span class="history-expr">${escapeHtml(pretty(item.expression))}</span><span class="history-result">= ${escapeHtml(item.result)}</span>`;
        exprBtn.addEventListener("click", () => {
          expr = item.expression;
          justEvaluated = false;
          errored = false;
          render();
        });

        li.appendChild(exprBtn);
        el.historyList.appendChild(li);
      });
    }

    function escapeHtml(s) {
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    // --- event wiring ------------------------------------------------------

    el.buttons.addEventListener("click", (ev) => {
      const btn = ev.target.closest("button");
      if (!btn) return;
      const { action, value, mem } = btn.dataset;
      switch (action) {
        case "append": append(value); break;
        case "equals": equals(); break;
        case "clear": clearAll(); break;
        case "delete": deleteLast(); break;
        case "negate": negate(); break;
        case "reciprocal": reciprocal(); break;
        case "answer": insertAnswer(); break;
        case "memory": handleMemory(mem); break;
      }
    });

    el.angleToggle.addEventListener("click", () => {
      Store.toggleAngleMode();
      render(); // preview depends on angle mode
    });

    el.themeToggle.addEventListener("click", () => Store.toggleTheme());

    el.historyToggle.addEventListener("click", () => {
      const show = el.historyPanel.hidden;
      el.historyPanel.hidden = !show;
      el.historyToggle.setAttribute("aria-pressed", String(show));
    });

    el.historyClear.addEventListener("click", () => Store.clearHistory());

    // Keyboard support
    document.addEventListener("keydown", (e) => {
      const k = e.key;
      if (/^[0-9]$/.test(k) || "+-*/^().%!".includes(k)) {
        append(k);
        e.preventDefault();
      } else if (k === ".") {
        append(".");
        e.preventDefault();
      } else if (k === "Enter" || k === "=") {
        equals();
        e.preventDefault();
      } else if (k === "Escape") {
        clearAll();
        e.preventDefault();
      } else if (k === "Backspace") {
        deleteLast();
        e.preventDefault();
      }
    });

    // --- boot --------------------------------------------------------------
    Store.onChange(syncFromStore);
    syncFromStore(Store.getState());
    render();
  }
})();
