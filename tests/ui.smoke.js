/**
 * UI interaction smoke test.
 *
 * Builds a harness from the REAL index.html (so it never drifts from the app),
 * injects a script that drives actual button clicks, and runs it in headless
 * Chrome — asserting the full UI → Engine → Store pipeline end to end.
 *
 * Run with: node tests/ui.smoke.js
 * Requires Google Chrome (looked up at common install paths).
 */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");

const testScript = `
<script>
function ready(fn){ if(document.readyState!=="loading") fn(); else document.addEventListener("DOMContentLoaded",fn); }
ready(()=>setTimeout(runSmoke,100));
function byVal(v){[...document.querySelectorAll(".buttons button")].find(b=>b.dataset.value===v).click();}
function byAct(a){[...document.querySelectorAll(".buttons button")].find(b=>b.dataset.action===a).click();}
function res(){return document.getElementById("result").textContent;}
function isErr(){return document.getElementById("result").classList.contains("error");}
const R=[];
function check(n,c){R.push((c?"PASS":"FAIL")+" "+n);}
function runSmoke(){
 try{
  byVal("9");byVal("+");byVal("3");byAct("equals");check("9+3=12",res()==="12");
  byAct("clear");byVal("(");byVal("2");byVal("+");byVal("3");byVal(")");byVal("*");byVal("4");byAct("equals");check("(2+3)*4=20",res()==="20");
  byAct("clear");byVal("2");byVal("+");byVal("3");byVal("*");byVal("4");byAct("equals");check("2+3*4=14 precedence",res()==="14");
  byAct("clear");byVal("5");byVal("/");byVal("0");byAct("equals");check("5/0 shows error",isErr());
  byAct("clear");byVal("sin(");byVal("3");byVal("0");byVal(")");byAct("equals");check("sin(30)=0.5 deg",res()==="0.5");
  byAct("clear");byVal("5");byVal("!");byAct("equals");check("5!=120",res()==="120");
  byAct("clear");byVal("8");byAct("negate");check("negate 8 = -8",document.getElementById("expression").textContent==="\\u22128");
  byAct("clear");byVal("4");byAct("reciprocal");byAct("equals");check("reciprocal 1/4=0.25",res()==="0.25");
  byAct("clear");byVal("6");byAct("equals");byVal("*");byVal("2");byAct("equals");check("chain 6 then *2=12",res()==="12");
 }catch(e){R.push("FAIL exception:"+e.message);}
 console.log("SMOKE_BEGIN "+R.join(" | ")+" SMOKE_END");
}
<\/script>
`;

const harnessPath = path.join(root, "_ui-smoke.html");
fs.writeFileSync(harnessPath, indexHtml.replace("</body>", testScript + "</body>"));

const chromeCandidates = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];
const chrome = chromeCandidates.find((p) => fs.existsSync(p));

if (!chrome) {
  console.log(`No Chrome found. Open ${harnessPath} manually and check the console for SMOKE_BEGIN…SMOKE_END.`);
  process.exit(0);
}

const url = "file:///" + harnessPath.replace(/\\/g, "/");
const proc = spawnSync(
  chrome,
  ["--headless=new", "--disable-gpu", "--enable-logging=stderr", "--v=0", "--virtual-time-budget=5000", url],
  { encoding: "utf8" }
);

// Chrome emits the smoke output via console.log, which lands on stderr here.
const combined = (proc.stdout || "") + (proc.stderr || "");
const m = combined.match(/SMOKE_BEGIN(.*)SMOKE_END/);
if (!m) {
  console.error("Smoke test produced no output. Open " + harnessPath + " manually to debug.");
  process.exit(1);
}

const lines = m[1].trim().split(" | ").filter(Boolean);
let failed = 0;
for (const line of lines) {
  console.log("  " + (line.startsWith("PASS") ? "✓ " + line.slice(5) : "✗ " + line.slice(5)));
  if (line.startsWith("FAIL")) failed++;
}
console.log(`\n${lines.length - failed} passed, ${failed} failed`);
fs.unlinkSync(harnessPath);
process.exit(failed === 0 && lines.length > 0 ? 0 : 1);
