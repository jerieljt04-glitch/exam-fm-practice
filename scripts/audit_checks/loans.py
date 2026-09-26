"""Loans: independent re-derivations by explicit period-by-period ledgers."""
import math

from .common import LOOSE, TOL, bisect, check, v

MONTHS = ["January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December"]


def month_end(year, index):
    y = year + index // 12
    m = index % 12
    leap = (y % 4 == 0 and y % 100 != 0) or y % 400 == 0
    days = [31, 29 if leap else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m]
    return f"{MONTHS[m]} {days}, {y}"


def pv_level(R, n, r):
    return sum(R * (1 + r) ** (-k) for k in range(1, n + 1))


def payment_for(L, n, r):
    return L / pv_level(1.0, n, r)


def run(L, payments, r):
    """Balance after applying the listed payments, one per period."""
    bal = L
    for R in payments:
        bal = bal * (1 + r) - R
    return bal


def count_full(L, R, r):
    """Number of full payments R before the balance would go below one payment."""
    bal, k = L, 0
    while bal * (1 + r) > R + 1e-9:
        bal = bal * (1 + r) - R
        k += 1
        if k > 100000:
            break
    return k, bal


@check("FM_LOAN_BALANCE_AFTER_K")
def _(p):
    if "m" not in p:
        return run(p["L"], [p["R"]] * p["k"], p["i"]), TOL
    r = p["j"] / p["m"]
    return run(p["L"], [p["R"]] * p["k"], r), TOL


@check("FM_LOAN_INTEREST_MULTIPLE_THEN_LEVEL")
def _(p):
    L, i = p["L"], p["i"]
    bal = L
    phases = [(p["n1"], 1.0), (p["n2"], p["m2"])] if p["twoPhase"] else [(p["n1"], p["m2"])]
    for count, mult in phases:
        for _ in range(count):
            bal = bal * (1 + i) - mult * i * bal
    return bisect(lambda X: run(bal, [X] * p["n3"], i), 0.0, bal * 2), LOOSE


@check("FM_LOAN_LEVEL_VS_PRINCIPAL_PLUS_INTEREST")
def _(p):
    L, n = p["L"], p["years"]
    total = n * payment_for(L, n, p["i1"])
    level = L / n

    def option2(i):
        bal, paid = L, 0.0
        for _ in range(n):
            paid += level + i * bal
            bal -= level
        return paid

    return bisect(lambda i: option2(i) - total, 0.0, 1.0) * 100, LOOSE


@check("FM_LOAN_GEOMETRIC_PAYMENTS_BALANCE")
def _(p):
    r = p["j"] / 12
    count = 12 * p["years"]
    pay = lambda t: p["P1"] * (1 + p["g"]) ** (t - 1)
    return sum(pay(t) * (1 + r) ** (-(t - p["k"])) for t in range(p["k"] + 1, count + 1)), TOL


@check("FM_LOAN_THREE_REPAYMENT_METHODS")
def _(p):
    L, m = p["L"], p["m"]
    r = p["j"] / m
    periods = m * p["years"]
    lump = L * (1 + r) ** periods - L
    interest_only = L * r * periods
    R = payment_for(L, periods, r)
    return lump + interest_only + periods * R - L, TOL


@check("FM_LOAN_PRINCIPAL_FROM_LATER_BALANCE")
def _(p):
    i, years, k = p["i"], p["years"], p["k"]
    R = p["balance"] / pv_level(1.0, years - k, i)
    bal = R * pv_level(1.0, years, i)
    principal = 0.0
    for _ in range(p["t"]):
        principal = R - bal * i
        bal -= principal
    return principal, TOL


@check("FM_LOAN_TOTAL_INTEREST_FROM_PRINCIPAL_PORTION")
def _(p):
    i, n, k = p["i"], p["years"], p["k"]
    R = bisect(lambda R: _principal_in(R * pv_level(1.0, n, i), R, i, k) - p["Pk"], 0.0, 1e7)
    return n * R - R * pv_level(1.0, n, i), LOOSE


def _principal_in(L, R, i, k):
    bal, principal = L, 0.0
    for _ in range(k):
        principal = R - bal * i
        bal -= principal
    return principal


@check("FM_LOAN_REFINANCE_REMAINING_BALANCE")
def _(p):
    B = run(p["L"], [p["R"]] * p["k"], p["j1"] / 12)
    return payment_for(B, p["count2"], p["j2"] / 12), TOL


@check("FM_LOAN_REFINANCE_SOLVE_RATE")
def _(p):
    r1 = p["j1"] / 12
    N = 12 * p["years"]
    R1 = payment_for(p["L"], N, r1)
    B = run(p["L"], [R1] * p["after"], r1)
    R2 = R1 - p["reduction"]
    r = bisect(lambda rate: pv_level(R2, N - p["after"], rate) - B, 1e-7, 0.05)
    return 12 * r * 100, LOOSE


@check("FM_LOAN_IRREGULAR_THEN_LEVEL")
def _(p):
    s, m, i = p["s"], p["m"], p["i"]
    early = [p["step"] * (k + 1) for k in range(s)]
    return bisect(lambda X: run(p["L"], early + [X] * m, i), 0.0, 1e7), LOOSE


@check("FM_LOAN_REAMORTIZE_RATE_CHANGE")
def _(p):
    if p["variant"] == "PAYMENT":
        r1, r2 = p["j1"] / 12, p["j2"] / 12
        N = 12 * p["years"]
        B = run(p["L"], [payment_for(p["L"], N, r1)] * p["after"], r1)
        return payment_for(B, N - p["after"], r2), TOL
    r1 = (1 + p["i1"]) ** (1 / 12) - 1
    r2 = (1 + p["i2"]) ** (1 / 12) - 1
    N = 12 * p["years"]
    B = run(p["L"], [payment_for(p["L"], N, r1)] * p["after"], r1)
    return B * r2, TOL


@check("FM_LOAN_DEFERRED_DROP_PAYMENT")
def _(p):
    m = p["m"]
    i = p["rate"] / (1 - p["rate"]) if p["useDiscount"] else p["rate"]
    j = (1 + i) ** (1 / m) - 1
    # Grow the loan to one period before the first payment, then run the ledger.
    bal = p["L"] * (1 + i) ** (p["first"] - 1 / m)
    full, remaining = count_full(bal, p["R"], j)
    if p["askCount"]:
        return full, TOL
    return remaining * (1 + j), LOOSE


@check("FM_LOAN_INTEREST_RATIOS_TERM")
def _(p):
    v2 = 1 / p["r1"] - 1
    vv = math.sqrt(v2)
    best = min(range(5, 80), key=lambda n: abs((1 - v2) / (1 - vv ** n) - p["r2"]))
    return best, TOL


@check("FM_LOAN_ROUNDED_PAYMENTS_FINAL")
def _(p):
    i = p["rate"] / (1 - p["rate"]) if p["useDiscount"] else p["rate"]
    R = payment_for(p["L"], p["years"], i)
    rounded = math.ceil(R / p["roundTo"]) * p["roundTo"]
    return run(p["L"], [rounded] * (p["years"] - 1), i) * (1 + i), TOL


@check("FM_LOAN_AMOUNT_FROM_COMPONENTS")
def _(p):
    n, k = p["years"], p["k"]

    def principal_k(i):
        L = p["I1"] / i
        return _principal_in(L, payment_for(L, n, i), i, k)

    i = bisect(lambda r: principal_k(r) - p["Pk"], 0.001, 0.5)
    return p["I1"] / i, LOOSE


@check("FM_LOAN_BALLOON_PAYMENT")
def _(p):
    if p["variant"] == "STEPPED":
        q = p["j"] / 4
        bal = run(p["L"], [p["R1"]] * (4 * p["years1"]), q)
        full, remaining = count_full(bal, p["R2"], q)
        # The balloon replaces the last full payment.
        return p["R2"] + remaining, LOOSE
    i = p["i"]
    bal = p["L"] * (1 + i) ** (p["start"] - 1)
    full, remaining = count_full(bal, p["R"], i)
    return p["R"] + remaining, LOOSE


@check("FM_LOAN_RATE_CHANGE_LEVEL_PAYMENT")
def _(p):
    def end(X):
        bal = p["L"]
        for y in range(1, p["years"] + 1):
            bal = bal * (1 + (p["i1"] if y <= p["T"] else p["i2"])) - X
        return bal

    return bisect(end, 0.0, p["L"]), LOOSE


@check("FM_LOAN_STEP_PAYMENTS_BALANCE")
def _(p):
    A, B, h = p["A"], p["B"], p["half"]

    def gap(i):
        L = (A + p["increase"]) / i
        return run(L, [A] * h + [B] * h, i)

    # The equation can have two roots; the question means the smaller rate
    # (the SOA sample states it as v^8 > 0.3). Scan for the first sign change.
    grid = [k / 1000 for k in range(1, 400)]
    lo = next(a for a, b in zip(grid, grid[1:]) if gap(a) * gap(b) < 0)
    i = bisect(gap, lo, lo + 0.001)
    L = (A + p["increase"]) / i
    return run(L, [A] * h, i), LOOSE


@check("FM_LOAN_FROM_PRINCIPAL_PORTIONS")
def _(p):
    var = p["variant"]
    L = p["L"]
    if var == "DROP":
        r = p["P2"] / p["P1"] - 1
        R = p["P1"] + r * L
        full, remaining = count_full(L, R, r)
        return remaining * (1 + r), LOOSE
    if var == "COUNT_BAL":
        P1, P2 = L - p["B1"], p["B1"] - p["B2"]
        r = P2 / P1 - 1
        R = P1 + r * L
    else:
        R = p["R"]
        r = (R - (L - p["B1"])) / L
    full, remaining = count_full(L, R, r)
    return full + (1 if remaining > 1e-6 else 0), TOL


@check("FM_LOAN_ACCUMULATED_BORROWING")
def _(p):
    bal = 0.0
    months1, months2 = 12 * p["years1"], 12 * p["years2"]
    for k in range(months1 + months2):
        rate = p["j1"] / 12 if k < months1 else p["j2"] / 12
        if k:
            bal *= 1 + rate
        bal += p["B"]
    return bal, TOL


@check("FM_LOAN_PRINCIPAL_LATER_PAYMENT")
def _(p):
    if p["variant"] == "PRINCIPAL":
        r = (1 + p["i"]) ** (1 / 12) - 1
        # Any loan with this rate works: build one and read the portions.
        n = p["b"] + 100
        L = 100000.0
        R = payment_for(L, n, r)
        ratio = _principal_in(L, R, r, p["b"]) / _principal_in(L, R, r, p["a"])
        return p["Pa"] * ratio, TOL
    r = p["nominal"] / p["m"]
    n = p["m"] * p["years"]
    R = p["Pa"] * (1 + r) ** (n - p["a"] + 1)
    L = pv_level(R, n, r)
    bal = run(L, [R] * (p["b"] - 1), r)
    return bal * r, TOL


@check("FM_LOAN_STEP_DOWN_INTEREST_RATIO")
def _(p):
    A, B, k = p["A"], p["B"], p["k"]

    def ratio(i):
        L = pv_level(A, 20, i) + (1 + i) ** -20 * pv_level(B, 10, i)
        b10 = run(L, [A] * 10, i)
        b20 = run(L, [A] * 20, i)
        return (b10 * i) / (b20 * i) - k

    i = bisect(ratio, 0.001, 1.0)
    L = pv_level(A, 20, i) + (1 + i) ** -20 * pv_level(B, 10, i)
    return run(L, [A] * 20, i) * i, LOOSE


@check("FM_LOAN_EXTRA_PAYMENT_REAMORTIZE")
def _(p):
    i = p["i"]
    L = pv_level(p["R"], p["years"], i)
    bal = run(L, [p["R"]] * p["k"], i) - p["extra"]
    return payment_for(bal, p["remaining"], i), TOL


@check("FM_LOAN_STEPPED_INTEREST_FIRST_PAYMENTS")
def _(p):
    i, h = p["i"], p["h"]
    L = pv_level(p["A"], h, i) + (1 + i) ** -h * pv_level(p["B"], h, i)
    bal, total = L, 0.0
    for _ in range(h):
        total += bal * i
        bal = bal * (1 + i) - p["A"]
    return total, TOL


@check("FM_LOAN_DROP_INTEREST_IN_PAYMENT")
def _(p):
    r = p["j"] / p["m"]
    return run(p["L"], [p["R"]] * (p["k"] - 1), r) * r, TOL


@check("FM_LOAN_MIDYEAR_SIMPLE_INTEREST")
def _(p):
    i = p["i"]
    R = payment_for(p["L"], p["years"], i)
    return run(p["L"], [R] * (p["year"] - 1), i) * (1 + p["fraction"] * i), TOL


@check("FM_LOAN_MISSED_PAYMENTS")
def _(p):
    r = p["j"] / 12
    if p["variant"] == "CATCHUP":
        N = 12 * p["years"]
        L = pv_level(p["R"], N, r)
        made = p["missFrom"] - 1
        c = p["c"]

        def end(X):
            payments = [p["R"]] * made + [0] * c + [X] * c + [p["R"]] * (N - made - 2 * c)
            return run(L, payments, r)

        return bisect(end, 0.0, 1e6), LOOSE
    N = p["N"]
    L = pv_level(p["R"], N, r)
    missed = set(range(p["missFrom"], p["missFrom"] + p["c"]))
    payments = [0 if k in missed else p["R"] for k in range(1, p["at"] + 1)]
    return run(L, payments, r), TOL


@check("FM_LOAN_LENDER_REINVESTMENT")
def _(p):
    m, years = p["m"], p["years"]
    count = m * years
    R = payment_for(p["L"], count, p["i"] / m)
    fund = 0.0
    for k in range(1, count + 1):
        year = math.ceil(k / m)
        rate = p["j2"] if (p["T"] and year > p["T"]) else p["j1"]
        if k > 1:
            fund *= 1 + rate / m
        fund += R
    if p["askInterest"]:
        return fund - p["L"], TOL
    return ((fund / p["L"]) ** (1 / years) - 1) * 100, TOL


@check("FM_LOAN_REFINANCE_TOTAL_COUNT")
def _(p):
    N = 12 * p["years"]
    r1, r2 = p["j1"] / 12, p["j2"] / 12
    X = payment_for(p["L"], N, r1)
    # Find how many payments bring the balance to the stated figure.
    bal, made = p["L"], 0
    while abs(bal - p["B"]) > 1.0 and made < N:
        bal = bal * (1 + r1) - X
        made += 1
    full, remaining = count_full(p["B"], X, r2)
    return made + full + (1 if remaining > 1e-6 else 0), TOL


@check("FM_LOAN_PRINCIPAL_EQUALS_INTEREST")
def _(p):
    i, n = p["i"], p["years"]
    R = payment_for(p["L"], n, i)
    bal, best, best_gap = p["L"], None, None
    for t in range(1, n + 1):
        interest = bal * i
        principal = R - interest
        gap = abs(principal - interest)
        if best_gap is None or gap < best_gap:
            best, best_gap = t, gap
        bal -= principal
    return best, TOL


@check("FM_LOAN_INCREASED_PAYMENT_EARLY_PAYOFF")
def _(p):
    r = p["j"] / 12
    if p["variant"] == "LOAN":
        N = 12 * p["years"]
        later = N - p["after"] - 12 * p["early"]

        def end(R):
            L = pv_level(R, N, r)
            return run(L, [R] * p["after"] + [p["P2"]] * later, r)

        R = bisect(end, 1.0, p["P2"])
        return pv_level(R, N, r), LOOSE
    N = 12 * p["years"]
    L = pv_level(p["R"], N, r)
    bal = run(L, [p["R"]] * p["after"], r)
    full, remaining = count_full(bal, p["P2"], r)
    return full + (1 if remaining > 1e-6 else 0), TOL


@check("FM_LOAN_GEOMETRIC_INCREASING_LOAN")
def _(p):
    r = p["j"] / 12 if p["monthly"] else p["j"]
    count, g, k = p["count"], p["g"], p["k"]
    first = bisect(lambda P: run(p["L"], [P * (1 + g) ** t for t in range(count)], r), 0.0, p["L"])
    payments = [first * (1 + g) ** t for t in range(count)]
    if p["askBalance"]:
        return run(p["L"], payments[:k], r), LOOSE
    bal = run(p["L"], payments[: k - 1], r)
    return payments[k - 1] - bal * r, LOOSE


@check("FM_LOAN_FORGIVEN_INTEREST")
def _(p):
    r = p["j"] / p["m"]
    N = p["m"] * p["years"]
    R = payment_for(p["L"], N, r)
    bal = run(p["L"], [R] * p["after"], r)
    return (N - p["after"]) * R - bal, TOL


@check("FM_LOAN_PAYMENT_FREQUENCY_RATE")
def _(p):
    count = p["p"] * p["years"]
    per_pay = bisect(lambda r: pv_level(p["R"], count, r) - p["L"], 1e-7, 0.3)
    per_conv = (1 + per_pay) ** (p["p"] / p["c"]) - 1
    return p["c"] * per_conv * 100, LOOSE


@check("FM_LOAN_TERM_FROM_PAYMENT")
def _(p):
    if p["variant"] == "PRINCIPAL":
        r = p["j"] / 12
        R = payment_for(p["C1"], p["months1"], r)
        full, remaining = count_full(p["C2"], R, r)
        return full + (1 if remaining > 1e-6 else 0), TOL
    target = p["factor"] * pv_level(1.0, p["n2"], p["r2"])
    return round(bisect(lambda n: (1 - (1 + p["r1"]) ** (-n)) / p["r1"] - target, 1, 2000)), TOL


@check("FM_LOAN_DROP_PAYMENT")
def _(p):
    full, remaining = count_full(p["L"], p["R"], p["i"])
    return remaining * (1 + p["i"]), TOL


@check("FM_LOAN_INTEREST_ONLY_THEN_LEVEL_COUNT")
def _(p):
    full, remaining = count_full(p["L"], p["R"], p["j2"] / 12)
    return 12 * p["ioYears"] + full + (1 if remaining > 1e-6 else 0), TOL


@check("FM_LOAN_SCHEDULES_EQUIVALENCE")
def _(p):
    if p["variant"] == "RATIO":
        r, h = p["j"] / 12, p["half"]
        loan_a = sum((p["a1"] if t <= h else p["a2"]) * (1 + r) ** (-t) for t in range(1, 2 * h + 1))
        loan_b = sum((p["b1"] if t < h else p["b2"]) * (1 + r) ** (-t) for t in range(0, 2 * h))
        return loan_a / loan_b, TOL
    r = bisect(lambda rate: pv_level(p["R1"], p["n1"], rate) - p["L"], 1e-7, 0.05)
    due = sum((1 + r) ** (-t) for t in range(p["n2"]))
    return p["L"] / due, LOOSE


@check("FM_LOAN_REFINANCE_SUM_OF_PAYMENTS")
def _(p):
    R1 = payment_for(p["L"], p["years"], p["i1"])
    B = run(p["L"], [R1] * p["after"], p["i1"])
    R2 = payment_for(B, p["newYears"], p["i2"])
    return p["after"] * R1 + p["newYears"] * R2, TOL


@check("FM_LOAN_LAST_INTEREST_TO_FIRST_PRINCIPAL")
def _(p):
    i = p["i"]
    # Last payment R, interest in it = R - R v.
    R = p["last"] / (1 - 1 / (1 + i))
    return R - p["L"] * i, TOL


@check("FM_LOAN_LUMP_VS_LEVEL_INTEREST")
def _(p):
    i = p["i"]
    lump = (1 + i) ** p["N"] - 1
    level = p["term"] * payment_for(1.0, p["term"], i) - 1
    return p["D"] / (lump - level), TOL


@check("FM_LOAN_LAST_PAYMENT_DATE")
def _(p):
    year, start = p["startYear"], p["startMonth"]
    if "extra" in p:
        r = p["j"] / 12
        R = payment_for(p["L"], 12 * p["years"], r)
        bal, month = p["L"], 0
        while True:
            month += 1
            bal *= 1 + r
            cal = (start + month - 1) % 12
            extra = p["extra"] if cal == 11 and (year + (start + month - 1) // 12) < year + p["extraYears"] else 0
            if bal <= R + extra + 1e-9:
                break
            bal -= R + extra
        return month_end(year, start + month - 1), None
    r1, r2 = p["j1"] / 12, p["j2"] / 12
    R1 = payment_for(p["L"], 12 * p["years"], r1)
    bal = run(p["L"], [R1] * p["made"], r1)
    full, remaining = count_full(bal, p["P"], r2)
    count = full + (1 if remaining > 1e-6 else 0)
    return month_end(year, start + p["made"] - 1 + count), None
