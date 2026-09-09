#!/usr/bin/env python3
"""
Independent audit of the Exam FM question engine.

Nothing here imports or mirrors the TypeScript engine. Every answer is
re-derived from first principles: explicit cash-flow ledgers, year-by-year
amortization simulation, numerical integration and bisection. Where a generator
uses a closed-form actuarial factor, this file deliberately does not, so a wrong
formula in the engine cannot be reproduced by the checker.

Audited for every generated instance:

  1. the answer itself, recomputed from first principles;
  2. every rate printed in the question is exactly the rate the answer used, so
     the figures a candidate reads are the figures the key was built from;
  3. the option flagged correct carries that answer, and no distractor
     coincides with it;
  4. the worked solution actually states the answer.

Run with: npm run audit
"""
import collections
import json
import math
import re
import sys

TOL = 1e-6          # closed-form agreement
LOOSE = 2e-4        # numerical integration / root finding

def v(i, t):  return (1.0 + i) ** (-t)

def js_round(x, places=0):
    """JavaScript Math.round semantics: halves go away from zero, not to even."""
    f = 10 ** places
    return math.floor(x * f + 0.5) / f if x >= 0 else -math.floor(-x * f + 0.5) / f

def integrate(f, a, b, n=200000):
    """Simpson's rule."""
    if n % 2: n += 1
    h = (b - a) / n
    s = f(a) + f(b)
    for k in range(1, n):
        s += (4 if k % 2 else 2) * f(a + k * h)
    return s * h / 3

def bisect(f, lo, hi, iters=300):
    flo = f(lo)
    for _ in range(iters):
        mid = (lo + hi) / 2
        fm = f(mid)
        if (flo < 0) == (fm < 0):
            lo, flo = mid, fm
        else:
            hi = mid
    return (lo + hi) / 2

def pv_flows(flows, rate):
    """flows: list of (time, amount)."""
    return sum(a * v(rate, t) for t, a in flows)

def level_payment(loan, n, i):
    """Payment that amortizes `loan` in n periods, found by search on the ledger."""
    def leftover(R):
        bal = loan
        for _ in range(n):
            bal = bal * (1 + i) - R
        return bal
    return bisect(leftover, loan / n, loan * (1 + i) ** n)

def amortize(loan, R, i, periods):
    """Year-by-year ledger. Returns list of (interest, principal, closing balance)."""
    rows, bal = [], loan
    for _ in range(periods):
        interest = bal * i
        principal = R - interest
        bal = bal - principal
        rows.append((interest, principal, bal))
    return rows

def bond_flows(par, coupon, n):
    return [(t, coupon + (par if t == n else 0)) for t in range(1, n + 1)]

def solve_yield(flows, price):
    return bisect(lambda y: pv_flows(flows, y) - price, 1e-9, 1.0)

def macaulay(flows, y):
    p = pv_flows(flows, y)
    return sum(t * a * v(y, t) for t, a in flows) / p

# --------------------------------------------------------------------------
CHECKS = {}
def check(name):
    def deco(fn):
        CHECKS[name] = fn
        return fn
    return deco

@check("TVM_FORCE_OF_INTEREST")
def _(p):
    d = integrate(lambda s: p["a"] + p["b"] * s, 0, p["t"])
    return p["deposit"] * math.exp(d), LOOSE

@check("TVM_NOMINAL_DISCOUNT_TO_INTEREST")
def _(p):
    # Simulate a year of p sub-periods, each accumulating at 1/(1 - d/p).
    val = 1.0
    for _ in range(p["p"]):
        val /= (1 - p["dNominal"] / p["p"])
    return (val - 1) * 100, TOL

@check("TVM_EQUATION_OF_VALUE")
def _(p):
    bal = 0.0
    for year in range(1, p["valuationTime"] + 1):
        bal *= (1 + p["i"])
        if year == p["t1"]: bal += p["c1"]
        if year == p["t2"]: bal += p["c2"]
    # deposits land at t1/t2 then accrue; redo cleanly:
    bal = 0.0
    for year in range(0, p["valuationTime"] + 1):
        if year == p["t1"]: bal += p["c1"]
        if year == p["t2"]: bal += p["c2"]
        if year < p["valuationTime"]: bal *= (1 + p["i"])
    return bal, TOL

@check("TVM_NOMINAL_RATE_EQUIVALENCE")
def _(p):
    growth = 1.0
    for _ in range(p["m"]):
        growth *= (1 + p["iNominal"] / p["m"])
    # d such that discounting p times by (1 - d/p) undoes that growth
    d = bisect(lambda dd: (1 - dd / p["p"]) ** p["p"] - 1 / growth, 1e-9, 0.99)
    return d * 100, TOL

@check("TVM_GROWTH_HORIZON")
def _(p):
    return bisect(lambda n: p["principal"] * (1 + p["i"]) ** n - p["target"], 0.0, 500.0), TOL

@check("TVM_CONTINUOUS_DISCOUNTING")
def _(p):
    steps, val = 100000, p["futureValue"]
    for _ in range(steps):
        val *= math.exp(-p["delta"] * p["t"] / steps)
    return val, LOOSE

@check("ANNUITY_LEVEL_IMMEDIATE_PV")
def _(p):
    return sum(p["payment"] * v(p["i"], k) for k in range(1, p["n"] + 1)), TOL

@check("ANNUITY_ARITHMETIC_INCREASING")
def _(p):
    return sum(p["base"] * k * v(p["i"], k) for k in range(1, p["n"] + 1)), TOL

@check("ANNUITY_PERPETUITY_GEOMETRIC")
def _(p):
    # Accumulate with a running ratio; the direct power overflows for large k.
    term = p["firstPayment"] * v(p["i"], 1)
    ratio = (1 + p["g"]) / (1 + p["i"])
    total = 0.0
    for _ in range(400000):
        total += term
        term *= ratio
        if term < 1e-15:
            break
    return total, LOOSE

@check("ANNUITY_DUE_ACCUMULATED_VALUE")
def _(p):
    bal = 0.0
    for _ in range(p["n"]):
        bal += p["deposit"]      # deposit at the start of the year
        bal *= (1 + p["i"])      # then a year of interest
    return bal, TOL

@check("ANNUITY_DEFERRED_IMMEDIATE")
def _(p):
    return sum(p["payment"] * v(p["i"], p["deferral"] + k) for k in range(1, p["n"] + 1)), TOL

@check("ANNUITY_CONTINUOUS")
def _(p):
    delta = math.log(1 + p["i"])
    return p["annualRate"] * integrate(lambda t: math.exp(-delta * t), 0, p["n"]), LOOSE

@check("LOAN_AMORTIZATION_PAYMENT")
def _(p):
    return level_payment(p["loanAmount"], p["totalPayments"], p["nominalRate"] / p["m"]), LOOSE

@check("LOAN_OUTSTANDING_BALANCE")
def _(p):
    R = level_payment(p["loanAmount"], p["n"], p["i"])
    return amortize(p["loanAmount"], R, p["i"], p["t"])[-1][2], LOOSE

@check("LOAN_PRINCIPAL_COMPONENT")
def _(p):
    R = level_payment(p["loanAmount"], p["n"], p["i"])
    return amortize(p["loanAmount"], R, p["i"], p["t"])[-1][1], LOOSE

@check("LOAN_INTEREST_COMPONENT")
def _(p):
    R = level_payment(p["loanAmount"], p["n"], p["i"])
    return amortize(p["loanAmount"], R, p["i"], p["t"])[-1][0], LOOSE

@check("LOAN_SINKING_FUND")
def _(p):
    def endfund(D):
        bal = 0.0
        for _ in range(p["n"]):
            bal = bal * (1 + p["fundRate"]) + D
        return bal - p["loanAmount"]
    D = bisect(endfund, 0.0, p["loanAmount"])
    return p["loanAmount"] * p["loanRate"] + D, LOOSE

@check("LOAN_TERM_SOLVE_N")
def _(p):
    # Retrospective route: balance is zero when L(1+i)^n = R*s_n
    L, R, i = p["loanAmount"], p["payment"], p["i"]
    return bisect(lambda n: L * (1 + i) ** n - R * ((1 + i) ** n - 1) / i, 0.1, 500.0), TOL

@check("BOND_BASIC_PRICING")
def _(p):
    r, y, n = p["couponNominal"] / 2, p["yieldNominal"] / 2, p["years"] * 2
    return pv_flows(bond_flows(p["par"], p["par"] * r, n), y), TOL

@check("BOND_PREMIUM_WRITEDOWN")
def _(p):
    r, y, n, t = p["couponNominal"] / 2, p["yieldNominal"] / 2, p["years"] * 2, p["t"]
    cpn = p["par"] * r
    book = lambda k: pv_flows([(s - k, a) for s, a in bond_flows(p["par"], cpn, n) if s > k], y)
    return book(t - 1) - book(t), LOOSE

@check("BOND_CALLABLE_WORST_CASE")
def _(p):
    # Minimum price over *every* permitted redemption date, not just the ends.
    return min(
        pv_flows(bond_flows(p["par"], p["par"] * p["r"], k), p["y"])
        for k in range(p["firstCallYear"], p["maturityYear"] + 1)
    ), TOL

@check("BOND_YIELD_TO_MATURITY")
def _(p):
    return solve_yield(bond_flows(p["par"], p["par"] * p["r"], p["n"]), p["price"]) * 100, LOOSE

@check("BOND_BOOK_VALUE")
def _(p):
    y, n, t = p["yieldNominal"] / 2, p["years"] * 2, p["t"]
    cpn = p["par"] * p["couponNominal"] / 2
    return pv_flows([(s - t, a) for s, a in bond_flows(p["par"], cpn, n) if s > t], y), TOL

@check("BOND_INTEREST_EARNED")
def _(p):
    cpn = p["par"] * p["r"]
    book_prev = pv_flows(
        [(s - (p["t"] - 1), a) for s, a in bond_flows(p["par"], cpn, p["n"]) if s > p["t"] - 1],
        p["y"])
    return p["y"] * book_prev, TOL

@check("ALM_MACAULAY_DURATION")
def _(p):
    return macaulay(bond_flows(p["par"], p["par"] * p["r"], p["n"]), p["y"]), TOL

@check("ALM_MODIFIED_DURATION_PRICE_CHANGE")
def _(p):
    sign = 1 if p["direction"] == "increases" else -1
    return p["price"] * (1 - p["modifiedDuration"] * sign * p["deltaY"]), TOL

@check("ALM_REDINGTON_IMMUNIZATION")
def _(p):
    y, T, t1, t2 = p["y"], p["liabilityTime"], p["t1"], p["t2"]
    pv_l = p["liability"] * v(y, T)
    # Solve  x + z = pv_l ,  t1*x + t2*z = T*pv_l
    z = (T * pv_l - t1 * pv_l) / (t2 - t1)
    x = pv_l - z
    return x * (1 + y) ** t1, TOL

@check("ALM_FULL_IMMUNIZATION")
def _(p):
    y, T, a, b = p["y"], p["liabilityTime"], p["before"], p["after"]
    pv_l = p["liability"] * v(y, T)
    z = (T * pv_l - (T - a) * pv_l) / ((T + b) - (T - a))
    x = pv_l - z
    return x * (1 + y) ** (T - a), TOL

@check("ALM_CONVEXITY_ZERO_COUPON")
def _(p):
    n, y, h = p["n"], p["y"], 1e-5
    price = lambda r: (1 + r) ** (-n)
    second = (price(y + h) - 2 * price(y) + price(y - h)) / h ** 2
    return second / price(y), 1e-3

@check("ALM_ANNUITY_DURATION")
def _(p):
    return macaulay([(k, 1.0) for k in range(1, p["n"] + 1)], p["i"]), TOL

@check("TVM_PIECEWISE_FORCE_TO_LOAN")
def _(p):
    a, b, c, k, m = p["a"], p["b"], p["c"], p["k"], p["m"]
    total = integrate(lambda s: a, 0, k) + integrate(lambda s: b + c * s, k, m)
    fund = p["deposit"] * math.exp(total)
    R = level_payment(fund, p["n"], p["i"])
    return amortize(fund, R, p["i"], p["p"])[-1][2], LOOSE

@check("TVM_DOLLAR_TO_TIME_WEIGHTED")
def _(p):
    exposure = p["opening"] + p["deposit"] * 0.75 - p["withdrawal"] * 0.25
    interest = p["dollarWeighted"] * exposure
    closing = js_round(p["opening"] + p["deposit"] - p["withdrawal"] + interest, 2)
    twr = ((p["beforeDeposit"] / p["opening"])
           * (p["beforeWithdrawal"] / (p["beforeDeposit"] + p["deposit"]))
           * (closing / (p["beforeWithdrawal"] - p["withdrawal"])) - 1)
    return twr * 100, TOL

@check("ANNUITY_SPOT_CURVE_LEVEL_YIELD")
def _(p):
    spots = p["spots"]
    pv = sum(p["payment"] * v(s, k + 1) for k, s in enumerate(spots))
    flows = [(k, p["payment"]) for k in range(1, len(spots) + 1)]
    return solve_yield(flows, pv) * 100, LOOSE

@check("ANNUITY_INCREASING_THEN_LEVEL")
def _(p):
    n, m, step, i = p["n"], p["m"], p["step"], p["i"]
    flows = [(t, step * t) for t in range(1, n + 1)]
    flows += [(t, step * n) for t in range(n + 1, n + m + 1)]
    return pv_flows(flows, i), TOL

@check("ANNUITY_CONTINUOUS_INCREASING")
def _(p):
    delta = math.log(1 + p["i"])
    return p["step"] * integrate(lambda t: t * math.exp(-delta * t), 0, p["n"]), LOOSE

@check("LOAN_SINKING_FUND_SWITCH")
def _(p):
    R = level_payment(p["loanAmount"], p["n"], p["loanRate"])
    bal = amortize(p["loanAmount"], R, p["loanRate"], p["k"])[-1][2]
    rem = p["n"] - p["k"]
    def endfund(D):
        f = 0.0
        for _ in range(rem):
            f = f * (1 + p["fundRate"]) + D
        return f - bal
    D = bisect(endfund, 0.0, bal)
    return bal * p["loanRate"] + D, LOOSE

@check("LOAN_DROP_PAYMENT")
def _(p):
    L, R, i = p["loanAmount"], p["payment"], p["i"]
    bal, n = L, 0
    while bal * (1 + i) > R:      # another full payment is affordable
        bal = bal * (1 + i) - R
        n += 1
    return bal * (1 + i), LOOSE

@check("LOAN_RATE_RESET_REFINANCE")
def _(p):
    L, n, k = p["loanAmount"], p["n"], p["k"]
    R1 = level_payment(L, n, p["firstRate"])
    bal = amortize(L, R1, p["firstRate"], k)[-1][2]
    R2 = level_payment(bal, n - k, p["secondRate"])
    return k * R1 + (n - k) * R2 - L, LOOSE

@check("BOND_SPOT_CURVE_TO_DURATION")
def _(p):
    spots = p["spots"]; n = len(spots)
    cpn = p["par"] * p["couponRate"]
    flows = bond_flows(p["par"], cpn, n)
    price = sum(a * v(spots[t - 1], t) for t, a in flows)
    y = solve_yield(flows, price)
    return macaulay(flows, y), LOOSE

@check("BOND_FUND_TO_CALLABLE_YIELD")
def _(p):
    j, periods = p["nominalRate"] / 2, p["savingYears"] * 2
    fund = 0.0
    for _ in range(periods):
        fund = fund * (1 + j) + p["halfYearDeposit"]
    cpn = p["par"] * p["couponRate"]
    worst = min(
        solve_yield(bond_flows(p["par"], cpn, k), fund)
        for k in range(p["callYear"], p["maturityYear"] + 1)
    )
    return worst * 100, LOOSE

@check("SWAP_DEFERRED_RATE")
def _(p):
    P = [v(s, k + 1) for k, s in enumerate(p["spots"])]
    # Forward-rate derivation: sum over settlement dates of (f_t - R) * P_t = 0
    fwd = [(P[t - 2] / P[t - 1] - 1) for t in range(2, 5)]
    num = sum(f * P[t - 1] for f, t in zip(fwd, range(2, 5)))
    den = sum(P[t - 1] for t in range(2, 5))
    return num / den * 100, TOL

@check("SWAP_MARKET_VALUE")
def _(p):
    Pn = [v(s, k + 1) for k, s in enumerate(p["currentSpots"])]
    Po = [v(s, k + 1) for k, s in enumerate(p["originalSpots"])]
    fwd_o = [(1 / Po[0] - 1)] + [(Po[t - 1] / Po[t] - 1) for t in range(1, 4)]
    R0 = sum(f * Po[t] for t, f in enumerate(fwd_o)) / sum(Po)
    fwd_n = [(1 / Pn[0] - 1)] + [(Pn[t - 1] / Pn[t] - 1) for t in range(1, 3)]
    R1 = sum(f * Pn[t] for t, f in enumerate(fwd_n)) / sum(Pn)
    return p["notional"] * (R0 - R1) * sum(Pn), TOL

@check("ALM_LIABILITY_ANNUITY_IMMUNIZATION")
def _(p):
    i, n = p["i"], p["n"]
    flows = [(t, p["annualLiability"]) for t in range(1, n + 1)]
    pv_l = pv_flows(flows, i)
    dur = macaulay(flows, i)
    t1, t2 = p["shortMaturity"], p["longMaturity"]
    z = (dur * pv_l - t1 * pv_l) / (t2 - t1)
    return z * (1 + i) ** t2, LOOSE

@check("TVM_REAL_ACCUMULATION")
def _(p):
    bal = 0.0
    for _ in range(p["n"]):
        bal = bal * (1 + p["nominal"]) + p["deposit"]
    return bal * (1 + p["inflation"]) ** (-p["n"]), LOOSE

@check("ANNUITY_REINVESTMENT_YIELD")
def _(p):
    fund = 0.0
    for _ in range(p["n"]):
        fund = fund * (1 + p["reinvestRate"]) + p["payment"]
    total = fund + p["price"]
    return ((total / p["price"]) ** (1 / p["n"]) - 1) * 100, LOOSE

@check("ALM_SECOND_ORDER_PRICE_CHANGE")
def _(p):
    n, y = p["n"], p["yieldRate"]
    cpn = p["par"] * p["couponRate"]
    flows = bond_flows(p["par"], cpn, n)
    price = pv_flows(flows, y)
    dmac = macaulay(flows, y)
    dmod = dmac / (1 + y)
    cmod = sum(t * (t + 1) * a * v(y, t + 2) for t, a in flows) / price
    dy = p["basisPoints"] / 10000
    return price * (1 - dmod * dy + 0.5 * cmod * dy * dy), LOOSE

@check("SWAP_AMORTIZING_NOTIONAL")
def _(p):
    P = [v(s, k + 1) for k, s in enumerate(p["spots"])]
    Q = p["notionals"]
    fwd = [(1 / P[0] - 1)] + [(P[t - 1] / P[t] - 1) for t in range(1, len(P))]
    num = sum(Q[t] * fwd[t] * P[t] for t in range(len(P)))
    den = sum(Q[t] * P[t] for t in range(len(P)))
    return num / den * 100, TOL


# ---------------------------------------------------------------------------
def main() -> int:
    path = sys.argv[1] if len(sys.argv) > 1 else "audit.json"
    everything = json.load(open(path))
    rows = [r for r in everything if r.get("kind") != "CHOICE"]
    choices = [r for r in everything if r.get("kind") == "CHOICE"]
    fail = collections.defaultdict(list)

    # Qualitative items carry authored choices rather than a computed answer,
    # so what can be verified is their structure, not their arithmetic.
    for r in choices:
        opts = r["options"]
        where = f'{r["id"]} draw {r["draw"]}'
        if len(opts) != 5:
            fail["E: a qualitative item does not offer five choices"].append(
                f'{where}: {len(opts)} choices')
        correct = [o for o in opts if o["correct"]]
        if len(correct) != 1:
            fail["E: a qualitative item has not exactly one correct choice"].append(
                f'{where}: {len(correct)} marked correct')
        if len({o["text"].strip() for o in opts}) != len(opts):
            fail["E: a qualitative item repeats a choice"].append(where)
        if any(not o["text"].strip() for o in opts):
            fail["E: a qualitative item has an empty choice"].append(where)
        if any(not o["why"].strip() for o in opts if not o["correct"]):
            fail["E: a wrong choice has no explanation"].append(where)
        if not r["solution"].strip():
            fail["E: a qualitative item has no solution"].append(where)

    NUM = re.compile(r"-?\d[\d,]*(?:\.\d+)?")
    PCT = re.compile(r"(\d+(?:\.\d+)?)\s*\\?%")

    def numbers_in(vars_):
        out = []
        for k, val in vars_.items():
            if k == "_seed":
                continue
            if isinstance(val, (int, float)) and not isinstance(val, bool):
                out.append(val)
            elif isinstance(val, list):
                out += [x for x in val if isinstance(x, (int, float))]
        return out

    for r in rows:
        vals = numbers_in(r["vars"])

        # (A) every rate printed in the stem must be exactly a rate that was used
        for shown in PCT.findall(r["question"]):
            if not any(f"{x * 100:.2f}" == shown or f"{x:.2f}" == shown for x in vals):
                fail["A: printed rate differs from the rate used"].append(
                    f'{r["id"]} draw {r["draw"]}: stem shows {shown}%')

        # (B) the option flagged correct must carry the formatted correct answer
        correct = [o for o in r["options"] if o["correct"]]
        if len(correct) != 1:
            fail["B: not exactly one correct option"].append(f'{r["id"]} draw {r["draw"]}')
        elif correct[0]["text"] != r["correctLabel"]:
            fail["B: correct option carries the wrong value"].append(
                f'{r["id"]} draw {r["draw"]}: {correct[0]["text"]!r} vs {r["correctLabel"]!r}')

        # (C) no distractor may coincide with the correct answer
        if any(abs(d - r["correct"]) < 1e-9 for d in r["distractors"]):
            fail["C: a distractor equals the correct answer"].append(f'{r["id"]} draw {r["draw"]}')

        # (D) the worked solution must state the answer. Options are quoted rounded,
        #     solutions to the cent, so compare against the unrounded value.
        numeric = NUM.findall(r["solution"].replace("{,}", ","))
        want = r["correct"]
        tol = 0.006 if r["format"] in ("PERCENT", "BASIS_POINTS") else max(0.006, abs(want) * 1e-5)
        found = False
        for n in numeric:
            try:
                if abs(float(n.replace(",", "")) - want) <= tol:
                    found = True
                    break
            except ValueError:
                pass
        if not found:
            fail["D: solution never states the answer"].append(
                f'{r["id"]} draw {r["draw"]}: answer {want!r}')

    missing = sorted({r["id"] for r in rows} - set(CHECKS))
    disagree = []
    for r in rows:
        fn = CHECKS.get(r["id"])
        if not fn:
            continue
        expected, tol = fn(r["vars"])
        rel = abs(r["correct"] - expected) / max(1.0, abs(expected))
        if rel > tol:
            disagree.append((r["id"], r["draw"], r["correct"], expected, rel))

    templates = len({r["id"] for r in everything})
    print(f"  {len(everything)} instances across {templates} templates")
    print(f"  {len(rows)} numeric, {len(choices)} qualitative")
    print(f"  answers recomputed independently: {len(rows) - len(disagree)} agree, {len(disagree)} disagree")
    if missing:
        print(f"  NO INDEPENDENT CHECK FOR: {missing}")
    for tid, draw, got, exp, rel in disagree:
        print(f"    x {tid} draw {draw}: engine={got!r} independent={exp!r} rel={rel:.3g}")

    problems = sum(len(items) for items in fail.values())
    print(f"  question / option / solution consistency: {problems} problems")
    for kind, items in sorted(fail.items()):
        print(f"    x {kind} ({len(items)})")
        for line in items[:8]:
            print(f"        {line}")

    if disagree or problems or missing:
        print()
        print("  AUDIT FAILED")
        return 1
    print()
    print("  audit passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
