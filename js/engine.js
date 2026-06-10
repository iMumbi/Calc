/**
 * engine.js — Calculation engine.
 *
 * Pure, DOM-free logic. Converts an infix expression string into a value using
 * a tokenizer + shunting-yard parser (to RPN) + RPN evaluator. No use of eval()
 * or Function() — input is fully sanitized by the tokenizer, which rejects any
 * symbol it does not recognise.
 *
 * Public API:
 *   Engine.evaluate(expression, options) -> number   (throws CalcError on failure)
 *   Engine.CalcError
 *
 * options: { angleMode: 'DEG' | 'RAD' }  (default 'DEG')
 *
 * Runs in the browser (attaches to window.Engine) and in Node (module.exports).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.Engine = api;
})(this, function () {
  "use strict";

  class CalcError extends Error {
    constructor(message) {
      super(message);
      this.name = "CalcError";
    }
  }

  // --- Operator / function tables -----------------------------------------

  // Binary operators: precedence + associativity + the operation itself.
  const OPERATORS = {
    "+": { prec: 2, assoc: "left", fn: (a, b) => a + b },
    "-": { prec: 2, assoc: "left", fn: (a, b) => a - b },
    "*": { prec: 3, assoc: "left", fn: (a, b) => a * b },
    "/": {
      prec: 3,
      assoc: "left",
      fn: (a, b) => {
        if (b === 0) throw new CalcError("Cannot divide by zero");
        return a / b;
      },
    },
    "^": { prec: 5, assoc: "right", fn: (a, b) => Math.pow(a, b) },
  };

  const UNARY_MINUS = "u-";
  const UNARY_PREC = 4; // binds tighter than * / but looser than ^

  // Postfix operators.
  const POSTFIX = {
    "!": { prec: 6, fn: factorial },
    "%": { prec: 6, fn: (a) => a / 100 },
  };

  // Named functions. Trig respects the active angle mode.
  function buildFunctions(angleMode) {
    const toRad = (x) => (angleMode === "DEG" ? (x * Math.PI) / 180 : x);
    const fromRad = (x) => (angleMode === "DEG" ? (x * 180) / Math.PI : x);
    return {
      sin: (x) => Math.sin(toRad(x)),
      cos: (x) => Math.cos(toRad(x)),
      tan: (x) => Math.tan(toRad(x)),
      asin: (x) => fromRad(Math.asin(x)),
      acos: (x) => fromRad(Math.acos(x)),
      atan: (x) => fromRad(Math.atan(x)),
      sqrt: (x) => {
        if (x < 0) throw new CalcError("Square root of negative number");
        return Math.sqrt(x);
      },
      ln: (x) => {
        if (x <= 0) throw new CalcError("Logarithm of non-positive number");
        return Math.log(x);
      },
      log: (x) => {
        if (x <= 0) throw new CalcError("Logarithm of non-positive number");
        return Math.log10(x);
      },
      exp: Math.exp,
      abs: Math.abs,
    };
  }

  const CONSTANTS = { pi: Math.PI, "π": Math.PI, e: Math.E };

  function factorial(n) {
    if (n < 0 || !Number.isInteger(n)) {
      throw new CalcError("Factorial requires a non-negative integer");
    }
    if (n > 170) throw new CalcError("Factorial too large"); // overflows to Infinity
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
  }

  // --- Tokenizer -----------------------------------------------------------

  const FUNCTION_NAMES = ["sin", "cos", "tan", "asin", "acos", "atan", "sqrt", "ln", "log", "exp", "abs"];

  function tokenize(input) {
    const tokens = [];
    let i = 0;
    const isDigit = (c) => c >= "0" && c <= "9";

    while (i < input.length) {
      const c = input[i];

      if (c === " " || c === "\t") {
        i++;
        continue;
      }

      // Numbers (including leading-dot decimals like .5)
      if (isDigit(c) || (c === "." && isDigit(input[i + 1]))) {
        let num = "";
        let dots = 0;
        while (i < input.length && (isDigit(input[i]) || input[i] === ".")) {
          if (input[i] === ".") dots++;
          if (dots > 1) throw new CalcError("Malformed number");
          num += input[i++];
        }
        tokens.push({ type: "number", value: parseFloat(num) });
        continue;
      }

      // Identifiers: functions or constants
      if (/[a-zπ]/i.test(c)) {
        let name = "";
        while (i < input.length && /[a-zπ]/i.test(input[i])) name += input[i++];
        const lower = name.toLowerCase();
        if (FUNCTION_NAMES.includes(lower)) {
          tokens.push({ type: "function", value: lower });
        } else if (Object.prototype.hasOwnProperty.call(CONSTANTS, lower) || name === "π") {
          tokens.push({ type: "number", value: CONSTANTS[lower] ?? CONSTANTS[name] });
        } else {
          throw new CalcError(`Unknown name "${name}"`);
        }
        continue;
      }

      if (c === "(" || c === ")") {
        tokens.push({ type: "paren", value: c });
        i++;
        continue;
      }

      if (c === ",") {
        tokens.push({ type: "comma", value: c });
        i++;
        continue;
      }

      if (Object.prototype.hasOwnProperty.call(OPERATORS, c)) {
        tokens.push({ type: "operator", value: c });
        i++;
        continue;
      }

      if (Object.prototype.hasOwnProperty.call(POSTFIX, c)) {
        tokens.push({ type: "postfix", value: c });
        i++;
        continue;
      }

      throw new CalcError(`Unexpected character "${c}"`);
    }

    return tokens;
  }

  // --- Shunting-yard: infix tokens -> RPN output queue --------------------

  function toRPN(tokens) {
    const output = [];
    const stack = [];

    const isValueLike = (tok) =>
      tok && (tok.type === "number" || tok.type === "postfix" || (tok.type === "paren" && tok.value === ")"));

    for (let idx = 0; idx < tokens.length; idx++) {
      const tok = tokens[idx];
      const prev = tokens[idx - 1];

      switch (tok.type) {
        case "number":
          output.push(tok);
          break;

        case "function":
          stack.push(tok);
          break;

        case "postfix": {
          // Postfix applies to the value already emitted.
          output.push(tok);
          break;
        }

        case "operator": {
          // Detect unary minus / plus.
          if (tok.value === "-" && !isValueLike(prev)) {
            stack.push({ type: "operator", value: UNARY_MINUS });
            break;
          }
          if (tok.value === "+" && !isValueLike(prev)) {
            break; // unary plus is a no-op
          }
          const o1 = tok.value;
          const prec1 = OPERATORS[o1].prec;
          while (stack.length) {
            const top = stack[stack.length - 1];
            if (top.type === "function") {
              output.push(stack.pop());
              continue;
            }
            if (top.type === "operator") {
              const isUnary = top.value === UNARY_MINUS;
              const prec2 = isUnary ? UNARY_PREC : OPERATORS[top.value].prec;
              const assoc1 = OPERATORS[o1].assoc;
              if (prec2 > prec1 || (prec2 === prec1 && assoc1 === "left")) {
                output.push(stack.pop());
                continue;
              }
            }
            break;
          }
          stack.push(tok);
          break;
        }

        case "comma":
          while (stack.length && !(stack[stack.length - 1].type === "paren")) {
            output.push(stack.pop());
          }
          break;

        case "paren":
          if (tok.value === "(") {
            stack.push(tok);
          } else {
            let foundParen = false;
            while (stack.length) {
              const top = stack.pop();
              if (top.type === "paren" && top.value === "(") {
                foundParen = true;
                break;
              }
              output.push(top);
            }
            if (!foundParen) throw new CalcError("Mismatched parentheses");
            // If a function precedes the group, pop it onto output.
            if (stack.length && stack[stack.length - 1].type === "function") {
              output.push(stack.pop());
            }
          }
          break;

        default:
          throw new CalcError("Invalid token");
      }
    }

    while (stack.length) {
      const top = stack.pop();
      if (top.type === "paren") throw new CalcError("Mismatched parentheses");
      output.push(top);
    }

    return output;
  }

  // --- RPN evaluator -------------------------------------------------------

  function evalRPN(rpn, functions) {
    const stack = [];

    for (const tok of rpn) {
      if (tok.type === "number") {
        stack.push(tok.value);
      } else if (tok.type === "operator") {
        if (tok.value === UNARY_MINUS) {
          if (stack.length < 1) throw new CalcError("Invalid expression");
          stack.push(-stack.pop());
        } else {
          if (stack.length < 2) throw new CalcError("Invalid expression");
          const b = stack.pop();
          const a = stack.pop();
          stack.push(OPERATORS[tok.value].fn(a, b));
        }
      } else if (tok.type === "postfix") {
        if (stack.length < 1) throw new CalcError("Invalid expression");
        stack.push(POSTFIX[tok.value].fn(stack.pop()));
      } else if (tok.type === "function") {
        if (stack.length < 1) throw new CalcError("Invalid expression");
        stack.push(functions[tok.value](stack.pop()));
      } else {
        throw new CalcError("Invalid expression");
      }
    }

    if (stack.length !== 1) throw new CalcError("Invalid expression");
    const result = stack[0];
    if (!Number.isFinite(result)) throw new CalcError("Result is not a finite number");
    return result;
  }

  // --- Public entry point --------------------------------------------------

  function evaluate(expression, options) {
    const opts = options || {};
    const angleMode = opts.angleMode === "RAD" ? "RAD" : "DEG";
    if (typeof expression !== "string" || expression.trim() === "") {
      throw new CalcError("Empty expression");
    }
    const tokens = tokenize(expression);
    if (tokens.length === 0) throw new CalcError("Empty expression");
    const rpn = toRPN(tokens);
    return evalRPN(rpn, buildFunctions(angleMode));
  }

  return { evaluate, CalcError, tokenize, toRPN };
});
