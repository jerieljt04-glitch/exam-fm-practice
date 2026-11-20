/** On-screen BA II Plus-style calculator: TVM, cash flows, amortization and key handling. */
import { amortize, computeTvm, irr, npv, TVM_DEFAULTS, type TvmRegisters } from "../../lib/calculator/finance";
import { displayText, INITIAL_STATE, press, type CalcState, type Key } from "../../lib/calculator/machine";
import { close, expect, test } from "./harness";

const reg = (r: Partial<TvmRegisters>): TvmRegisters => ({ ...TVM_DEFAULTS, ...r });

test("calculator: TVM solves each register as the BA II Plus does", () => {
  // 30-year mortgage, 6% monthly: PMT = −1,199.10.
  close(computeTvm(reg({ N: 360, IY: 6, PV: 200000, FV: 0, PY: 12, CY: 12 }), "PMT"), -1199.1010503, "mortgage PMT", 1e-8);
  close(computeTvm(reg({ IY: 5, PV: 1000, PMT: -100, FV: 0 }), "N"), 14.2066990829, "N for a 1000 loan at 5% paying 100", 1e-8);
  close(computeTvm(reg({ N: 10, PV: -1000, PMT: 0, FV: 2000 }), "IY"), 7.1773462536, "I/Y doubling in 10 years", 1e-8);
  close(computeTvm(reg({ N: 10, IY: 5, PMT: -100, FV: 0, bgn: true }), "PV"), 810.7821676, "annuity-due PV in BGN", 1e-8);
  close(computeTvm(reg({ N: 10, IY: 5, PV: 0, PMT: -100 }), "FV"), 1257.7892535, "FV of an annuity-immediate", 1e-8);
  close(computeTvm(reg({ N: 20, IY: 8, PMT: -50, FV: -1000, PY: 2, CY: 2 }), "PV"), 1135.9032634, "bond price, semiannual (P/Y = C/Y = 2)", 1e-8);
  // Effective-rate conversion: I/Y 12% compounded monthly, annual payments.
  close(computeTvm(reg({ N: 1, IY: 12, PV: -100, PMT: 0, PY: 1, CY: 12 }), "FV"), 112.6825030, "C/Y ≠ P/Y conversion", 1e-8);
});

test("calculator: cash-flow worksheet NPV and IRR, and the AMORT worksheet", () => {
  close(npv(10, -1000, [{ amount: 400, count: 3 }]), -5.2592036, "NPV at 10%", 1e-8);
  close(irr(-1000, [{ amount: 400, count: 3 }]), 9.7010257, "IRR", 1e-6);
  close(irr(-100, [{ amount: 50, count: 1 }, { amount: 70, count: 1 }]), 12.3212460, "IRR with uneven flows", 1e-6);
  const loan = reg({ N: 10, IY: 10, PV: 1000, FV: 0 });
  loan.PMT = computeTvm(loan, "PMT");
  const first = amortize(loan, 1, 1);
  close(first.INT, -100, "first payment's interest", 1e-9);
  close(first.PRN, loan.PMT + 100, "first payment's principal", 1e-9);
  const all = amortize(loan, 1, 10);
  close(all.BAL, 0, "balance after the last payment", 1e-7);
  close(all.PRN, -1000, "total principal repaid", 1e-7);
});

function keys(seq: Array<Key | number | string>, start: CalcState = INITIAL_STATE): CalcState {
  let s = start;
  for (const k of seq) {
    if (typeof k === "number") s = press(s, { kind: "digit", d: k });
    else if (k === ".") s = press(s, { kind: "dot" });
    else if (typeof k === "string") throw new Error(k);
    else s = press(s, k);
  }
  return s;
}

test("calculator: chain arithmetic, memories, 2nd and CPT behave like the handheld", () => {
  const plus = { kind: "op", op: "+" } as const;
  const times = { kind: "op", op: "*" } as const;
  const eq = { kind: "equals" } as const;
  expect(keys([2, plus, 3, times, 4, eq]).x === 20, "chain mode: 2 + 3 × 4 = 20 (left to right)");
  expect(Math.abs(keys([1, ".", 0, 5, { kind: "op", op: "pow" }, 1, 0, eq]).x - Math.pow(1.05, 10)) < 1e-12, "y^x");
  expect(keys([1, 0, 0, { kind: "sto" }, 3, { kind: "clear" }, { kind: "rcl" }, 3]).x === 100, "STO 3 then RCL 3");
  expect(keys([1, { kind: "op", op: "/" }, 0, eq]).error, "division by zero is an error");
  const tvm = keys([
    1, 0, { kind: "tvm", reg: "N" },
    5, { kind: "tvm", reg: "IY" },
    1, 0, 0, { kind: "sign" }, { kind: "tvm", reg: "PMT" },
    0, { kind: "tvm", reg: "FV" },
    { kind: "cpt" }, { kind: "tvm", reg: "PV" },
  ]);
  expect(Math.abs(tvm.x - 772.1734929) < 1e-6 && tvm.label === "PV=", `CPT PV (${tvm.x})`);
  expect(displayText(tvm, 2) === "772.17", `display at 2 decimals (${displayText(tvm, 2)})`);
  const bgn = press(tvm, { kind: "bgn" });
  expect(bgn.tvm.bgn && bgn.label === "BGN", "BGN toggles payment timing");
  expect(Math.abs(keys([{ kind: "cpt" }, { kind: "tvm", reg: "PV" }], bgn).x - 810.7821676) < 1e-6, "CPT PV in BGN mode");
  expect(press(press(INITIAL_STATE, { kind: "second" }), { kind: "digit", d: 4 }).second === false, "2nd is consumed by the next key");
});
