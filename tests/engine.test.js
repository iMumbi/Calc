/**
 * Unit tests for the calculation engine.
 * Run with: node tests/engine.test.js
 *
 * Uses only Node's built-in assert — no external test framework required,
 * keeping the project dependency-free per CLAUDE.md.
 */
const assert = require("node:assert");
const Engine = require("../js/engine.js");

let passed = 0;
let failed = 0;

function approx(actual, expected, eps = 1e-9) {
  return Math.abs(actual - expected) < eps;
}

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`      ${err.message}`);
  }
}

function evalEq(expr, expected, opts) {
  const result = Engine.evaluate(expr, opts);
  assert.ok(
    approx(result, expected),
    `"${expr}" => ${result}, expected ${expected}`
  );
}

function evalThrows(expr, opts) {
  assert.throws(() => Engine.evaluate(expr, opts), Engine.CalcError, `"${expr}" should throw`);
}

console.log("\nBasic arithmetic");
test("addition", () => evalEq("9 + 3", 12));
test("subtraction", () => evalEq("10 - 4", 6));
test("multiplication", () => evalEq("6 * 7", 42));
test("division", () => evalEq("20 / 5", 4));
test("decimals", () => evalEq("1.5 + 2.5", 4));
test("leading-dot decimal", () => evalEq(".5 + .5", 1));

console.log("\nOperator precedence & parentheses");
test("precedence mul before add", () => evalEq("2 + 3 * 4", 14));
test("parentheses override", () => evalEq("(2 + 3) * 4", 20));
test("nested parentheses", () => evalEq("((1 + 2) * (3 + 4))", 21));
test("chained operations", () => evalEq("5 + 3 - 2", 6));
test("division then multiply left-assoc", () => evalEq("8 / 4 / 2", 1));

console.log("\nNegative & unary");
test("unary minus", () => evalEq("-5 + 2", -3));
test("unary minus with parens", () => evalEq("-(3 + 2)", -5));
test("double negative", () => evalEq("--5", 5));
test("negative multiplication", () => evalEq("3 * -2", -6));
test("unary plus no-op", () => evalEq("+7", 7));

console.log("\nPowers & roots");
test("power", () => evalEq("2 ^ 10", 1024));
test("power right-assoc", () => evalEq("2 ^ 3 ^ 2", 512));
test("sqrt", () => evalEq("sqrt(16)", 4));
test("sqrt of sum", () => evalEq("sqrt(9 + 16)", 5));
test("power binds tighter than unary minus", () => evalEq("-2 ^ 2", -4));

console.log("\nScientific functions");
test("sin 30 deg", () => evalEq("sin(30)", 0.5, { angleMode: "DEG" }));
test("cos 60 deg", () => evalEq("cos(60)", 0.5, { angleMode: "DEG" }));
test("tan 45 deg", () => evalEq("tan(45)", 1, { angleMode: "DEG" }));
test("sin pi rad", () => evalEq("sin(pi)", 0, { angleMode: "RAD" }));
test("ln e", () => evalEq("ln(e)", 1));
test("log 1000", () => evalEq("log(1000)", 3));
test("exp 0", () => evalEq("exp(0)", 1));
test("abs negative", () => evalEq("abs(-7)", 7));

console.log("\nConstants");
test("pi", () => evalEq("pi", Math.PI));
test("e", () => evalEq("e", Math.E));
test("pi symbol", () => evalEq("π", Math.PI));
test("2 pi", () => evalEq("2 * pi", 2 * Math.PI));

console.log("\nPostfix: factorial & percent");
test("factorial 5", () => evalEq("5!", 120));
test("factorial 0", () => evalEq("0!", 1));
test("percent", () => evalEq("50%", 0.5));
test("percent in expression", () => evalEq("200 * 10%", 20));
test("factorial then add", () => evalEq("3! + 1", 7));

console.log("\nReciprocal & combined");
test("reciprocal via power", () => evalEq("4 ^ -1", 0.25));
test("complex expression", () => evalEq("sqrt(144) + 2 ^ 3 - 5 * 2", 10));

console.log("\nError handling");
test("divide by zero throws", () => evalThrows("5 / 0"));
test("sqrt negative throws", () => evalThrows("sqrt(-4)"));
test("ln zero throws", () => evalThrows("ln(0)"));
test("log negative throws", () => evalThrows("log(-1)"));
test("negative factorial throws", () => evalThrows("(-3)!"));
test("non-integer factorial throws", () => evalThrows("2.5!"));
test("mismatched parens throws", () => evalThrows("(2 + 3"));
test("mismatched close paren throws", () => evalThrows("2 + 3)"));
test("unknown name throws", () => evalThrows("foo(2)"));
test("illegal character throws", () => evalThrows("2 @ 3"));
test("empty expression throws", () => evalThrows(""));
test("incomplete expression throws", () => evalThrows("2 +"));

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
