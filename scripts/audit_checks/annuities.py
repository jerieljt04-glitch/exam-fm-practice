"""Annuities: independent re-derivations by explicit cash-flow sums and ledgers."""
import math

from .common import LOOSE, TOL, bisect, check, grow, integrate, pv_flows, v


def fund_value(deposits, rate_for_year, horizon):
    """Year-by-year fund ledger. `deposits` maps time -> amount deposited at that
    time; interest for year k (from k-1 to k) uses rate_for_year(k)."""
    fund = 0.0
    for t in range(horizon):
        fund += deposits.get(t, 0.0)
        fund *= 1 + rate_for_year(t + 1)
    return fund + deposits.get(horizon, 0.0)


@check("FM_ANN_BLOCK_DEPOSITS_RATIO")
def _(p):
    k, N, M, D = p["k"], p["N"], p["M"], p["D"]

    def value_at(i, horizon):
        return sum(D * (1 + i) ** (horizon - t) for t in range(0, horizon, k))

    i = bisect(lambda r: value_at(r, N) - p["ratio"] * value_at(r, M), 1e-4, 1.0)
    return value_at(i, N), LOOSE


@check("FM_ANN_PERPETUITY_SPLIT_SHARES")
def _(p):
    # Pick any rate and term consistent with the first share, then sum directly.
    i = 0.05
    n = math.log(1 - p["s"]) / -math.log(1 + i)
    total = 1 / i
    first = (1 - v(i, n)) / i
    second = v(i, n) * (1 - v(i, n)) / i
    third = total - first - second
    return (second if p["askSecond"] else third) / total * 100, LOOSE


@check("FM_ANN_PERPETUITY_FREQUENCY_CONVERSION")
def _(p):
    k, R, P1 = p["k"], p["R"], p["P1"]

    def first_pv(i):
        start = 0 if p["firstDue"] else k
        return sum(R * v(i, start + k * m) for m in range(4000))

    i = bisect(lambda r: first_pv(r) - P1, 1e-3, 1.0)
    step = p["months"] / 12
    start = 0 if p["secondDue"] else step
    return sum(p["S"] * v(i, start + step * m) for m in range(int(4000 / step))), LOOSE


@check("FM_ANN_RETIREMENT_INCOME_FACTOR")
def _(p):
    fund = p["income"] / p["rate"] * 1000
    r = p["j"] / 12
    months = 12 * p["years"]
    per_unit = sum((1 + r) ** (months - t) for t in range(months))
    return fund / per_unit, LOOSE


@check("FM_ANN_COLLEGE_FUNDING_BIRTHDAYS")
def _(p):
    i, last = p["i"], p["last"]
    pv_w = sum(p["W"] * v(i, t) for t in range(last + 1, last + 1 + p["count"]))
    pv_unit = sum(v(i, t) for t in range(1, last + 1))
    return pv_w / pv_unit, TOL


@check("FM_ANN_FINAL_SMALLER_WITHDRAWAL")
def _(p):
    i, m = p["i"], p["m"]
    fund = fund_value({t: p["D"] for t in range(p["N"])}, lambda k: i, p["N"])
    j = (1 + i) ** (1 / m) - 1
    bal = fund
    while True:
        if bal <= p["W"]:
            return bal, LOOSE
        bal = (bal - p["W"]) * (1 + j)


@check("FM_ANN_TWO_RATE_ACCUMULATION_DEPOSIT")
def _(p):
    n1, n2 = p["n1"], p["n2"]
    unit = fund_value({t: 1.0 for t in range(1, n1 + 1)}, lambda k: p["i1"] if k <= n1 else p["i2"], n1 + n2)
    return p["F"] / unit, TOL


@check("FM_ANN_TUITION_FUND_SHORTFALL")
def _(p):
    i, g, N, T0 = p["i"], p["g"], p["N"], p["T0"]
    fund = 0.0
    for t in range(N):
        fund = fund * (1 + i) if t else 0.0
        fund += p["D"]
    fund -= T0 * (1 + g) ** (N - 1)
    fund *= 1 + i
    return T0 * (1 + g) ** N - fund, TOL


@check("FM_ANN_MAX_INTEGER_DEFERRAL")
def _(p):
    r = p["j"] / 12
    best = None
    for n in range(1, 30):
        value = p["A"] * (1 + r) ** (60 - n) + p["c"] * p["A"] * (1 + r) ** (60 - 2 * n)
        if value >= p["target"]:
            best = n
    return best, TOL


@check("FM_ANN_MONTHLY_DEPOSITS_ANNUAL_WITHDRAWALS")
def _(p):
    i = p["i"]
    r = (1 + i) ** (1 / 12) - 1
    pv_w = sum(p["W"] * v(i, t) for t in p["times"])
    pv_unit = sum((1 + r) ** (-m) for m in range(12 * p["depositYears"]))
    return pv_w / pv_unit, LOOSE


@check("FM_ANN_PERPETUITY_DUE_EXCHANGE_TWO_RATES")
def _(p):
    i1, i2, T = p["i1"], p["i2"], p["T"]

    def disc(t):
        return v(i1, min(t, T)) * v(i2, max(0, t - T))

    perp = sum(p["P"] * disc(t) for t in range(3000))
    annuity = sum(disc(t) for t in range(p["term"]))
    return perp / annuity, LOOSE


@check("FM_ANN_ESTATE_INTEREST_SPLIT")
def _(p):
    i = p["i"]
    x = bisect(lambda X: v(i, X) / (1 - v(i, X)) - p["ratio"], 0.01, 200)
    return round(x), TOL


@check("FM_ANN_CONTINUOUS_RATIO_AV")
def _(p):
    term, k, m = p["term"], p["k"], p["m"]

    def abar(n, d):
        return integrate(lambda t: math.exp(-d * t), 0, n, 400)

    d = bisect(lambda delta: abar(2 * term, delta) - k * abar(term, delta), 1e-4, 0.5)
    return integrate(lambda t: math.exp(d * (m - t)), 0, m, 400), LOOSE


@check("FM_ANN_AV_EQUALS_PERPETUITY")
def _(p):
    i = p["i"]
    # Solve for the (real-valued) term n from the two expressions, then evaluate.
    f = lambda n: p["P1"] * ((1 + i) ** n - 1) / i - p["P2"] / ((1 + i) ** n - 1)
    n = bisect(f, 0.1, 200)
    return p["P1"] * ((1 + i) ** n - 1) / i, LOOSE


@check("FM_ANN_FV_PV_RATIO_RATE")
def _(p):
    # Try every whole number of payments: the ratio fixes the per-period rate,
    # and only the true count also reproduces the accumulated value.
    m, pay = p["m"], p["payment"]
    best = None
    for count in range(2, 400):
        j = (p["F"] / p["P"]) ** (1 / (count - 1)) - 1
        fv = sum(pay * (1 + j) ** k for k in range(count))
        err = abs(fv - p["F"])
        if best is None or err < best[0]:
            best = (err, j)
    return ((1 + best[1]) ** m - 1) * 100, LOOSE


@check("FM_ANN_INTEREST_WITHDRAWN_TO_SECOND_FUND")
def _(p):
    bal, fund_y = p["A"], 0.0
    for _ in range(p["count"]):
        interest = bal * p["i1"]
        withdrawal = interest + p["W"]
        bal -= p["W"]
        fund_y = fund_y * (1 + p["i2"]) + withdrawal
    return fund_y, TOL


@check("FM_ANN_REINVESTED_INTEREST")
def _(p):
    count, due, j = p["count"], p["due"], p["j"]

    def total(i, D):
        principal, side = 0.0, 0.0
        for year in range(1, count + 1):
            if due:
                principal += D
            side = side * (1 + j) + principal * i
            if not due:
                principal += D
        return principal + side

    if p["variant"] == "AV":
        return total(p["i"], p["D"]), TOL
    if p["variant"] == "DEPOSIT":
        return p["F"] / total(p["i"], 1.0), TOL
    return bisect(lambda i: total(i, p["D"]) - p["F"], 0.0, 2.0) * 100, LOOSE


@check("FM_ANN_ANNUITY_VS_GAPPED_PERPETUITY")
def _(p):
    g, L, P = p["gap"], p["L"], p["P"]

    def diff(i):
        annuity = sum(L * v(i, t) for t in range(1, 2 * g + 1))
        perp = sum(P * v(i, t) for t in range(1, g + 1)) + P * v(i, 2 * g) / i
        return annuity - perp

    return bisect(diff, 0.0005, 1.0) * 100, LOOSE


@check("FM_ANN_ENDOWMENT_DEFERRED_PERPETUITY")
def _(p):
    r = p["j"] / 12
    fund = 0.0
    for month in range(12 * p["n1"]):
        fund = (fund + p["D"]) * (1 + r)
    fund = grow(fund, r, 12 * p["n2"])
    # Perpetuity-due: fund = X (1 + v + v^2 + ...) = X (1+r)/r
    return fund * r / (1 + r), TOL


@check("FM_ANN_TWO_RATE_DEFERRED_PERPETUITY")
def _(p):
    i1, i2, T = p["i1"], p["i2"], p["T"]
    disc = lambda t: v(i1, min(t, T)) * v(i2, max(0, t - T))
    unit = sum(disc(t) for t in range(p["defer"], 5000))
    return p["PV"] / unit, LOOSE


@check("FM_ANN_WITHDRAWALS_RESTORE_FUND")
def _(p):
    i, F, years = p["i"], p["F"], p["end"] - p["start"]

    def final(P):
        bal = F - P
        for _ in range(years):
            bal = bal * (1 + i) - P
        return bal - F

    return bisect(final, 0.0, F), LOOSE


@check("FM_ANN_MTHLY_FACTOR_EQUIVALENCE")
def _(p):
    # i from s_k; m-thly factor as given; PV equality by explicit sums.
    k, m, term = p["k"], p["m"], p["term"]
    i = bisect(lambda r: sum((1 + r) ** t for t in range(k)) - p["sk"], 1e-6, 1.0)
    pv_x = p["sm"] * sum(v(i, t) for t in range(1, term + 1))
    pv_y_unit = sum(v(i, t) for t in range(k, term + 1, k))
    return pv_x / pv_y_unit, 2e-4


@check("FM_ANN_FUND_PURCHASES_ANNUITY")
def _(p):
    if p["variant"] == "PAYMENT":
        r = (1 + p["i1"]) ** (1 / 12) - 1
        fund = 0.0
        for _ in range(12 * p["years"]):
            fund = (fund + p["D"]) * (1 + r)
        return fund / sum(v(p["i2"], t) for t in range(p["term"])), LOOSE
    fund = fund_value({t: p["D"] for t in range(p["years"])}, lambda k: p["i1"], p["years"])
    r = p["j"] / 12
    cost = sum(p["M"] * (1 + r) ** (-t) for t in range(12 * p["term"]))
    return fund - cost, LOOSE


@check("FM_ANN_REPEATING_PATTERN_PERPETUITY")
def _(p):
    A, i = p["A"], p["i"]

    def price(X):
        return sum((X if t % 3 == 1 else A) * v(i, t) for t in range(3000))

    return bisect(lambda X: price(X) - p["price"], -1e6, 1e7), LOOSE


@check("FM_ANN_CONTRIBUTIONS_DEFERRED_PERPETUITY")
def _(p):
    r = p["j"] / 12
    months = 12 * p["years"]
    # Value everything at time 0 by explicit monthly/annual sums.
    perp = sum(p["P"] * (1 + r) ** (-12 * (p["years"] + k)) for k in range(400))
    unit = sum((1 + r) ** (-t) for t in range(1, months + 1))
    return perp / unit, LOOSE


@check("FM_ANN_PERPETUITY_DUE_FREQUENCY_RATE")
def _(p):
    def gap(i):
        w = (1 + i) ** (-1 / 12)
        return p["A"] * (1 - w) - p["B"] * (1 - w * w)

    return bisect(gap, 1e-4, 3.0) * 100, LOOSE


@check("FM_ANN_QUARTERLY_VS_ODD_YEAR_PAYMENTS")
def _(p):
    i = p["i"]
    pv = sum(p["Q"] * v(i, t / 4) for t in range(4 * p["years"]))
    unit = sum(v(i, t) for t in range(1, p["years"], 2))
    return pv / unit, TOL


@check("FM_ANN_CONTINUOUS_VARYING_FORCE_RATE")
def _(p):
    a, T = p["a"], p["T"]
    growth = lambda t: math.exp(integrate(lambda s: 1 / (a + s), t, T, 200))
    per_k = integrate(lambda t: (a + t) * growth(t), 0, T, 400)
    return p["AV"] / per_k, LOOSE


@check("FM_ANN_CONTINUOUS_PIECEWISE_PERPETUITY")
def _(p):
    T, i, g, R = p["T"], p["i"], p["g"], p["R"]
    d = math.log(1 + i)
    rate = lambda t: R if t < T else R * (1 + g) ** (t - T)
    first = integrate(lambda t: rate(t) * math.exp(-d * t), 0, T, 2000)
    # The tail converges geometrically; integrate far enough out.
    tail = integrate(lambda t: rate(t) * math.exp(-d * t), T, T + 2500, 200000)
    return first + tail, LOOSE


@check("FM_ANN_DEPOSIT_SCHEDULE_TO_PERPETUITY")
def _(p):
    fund = fund_value({k: amount for k, amount in enumerate(p["deposits"])}, lambda k: p["i1"], p["H"])
    j = (1 + p["i2"]) ** 0.5 - 1
    return fund / sum((1 + j) ** (-t) for t in range(1, 20000)), LOOSE


@check("FM_ANN_CONTINUOUS_EXPONENTIAL_PAYMENTS")
def _(p):
    f = lambda t: p["A"] * math.exp(p["c"] * t) * math.exp(p["delta"] * (p["t3"] - t))
    return integrate(f, p["t1"], p["t2"]), LOOSE


# --------------------------------------------------------------------------
# Non-level annuities


def pv_list(payments, i, first):
    return sum(a * v(i, first + k) for k, a in enumerate(payments))


def grown(g, i, k, t):
    """(1+g)^k v^t without overflowing for large k and t."""
    return math.exp(k * math.log(1 + g) - t * math.log(1 + i))


@check("FM_ANN_ARITHMETIC_THEN_LEVEL_PERPETUITY_N")
def _(p):
    unit, i = p["unit"], p["i"]

    def price(n):
        rising = sum(unit * k * v(i, k + 1) for k in range(1, n + 1))
        return rising + unit * n * v(i, n + 1) / i

    return min(range(1, 80), key=lambda n: abs(price(n) - p["price"])), TOL


@check("FM_ANN_EXCHANGE_FOR_GEOMETRIC")
def _(p):
    i = p["i"]
    if p["perpetual"]:
        value = sum(p["P"] * v(i, t) for t in range(1, 6000))
    else:
        value = sum(p["P"] * v(i, t) for t in range(1, p["sourceTerm"] - p["after"] + 1))
    if p["semi"]:
        j = (1 + i) ** 0.5 - 1
        unit = sum(grown(p["g"], j, k, k + 1) for k in range(20000))
        return value / unit, LOOSE
    unit = sum((1 + p["g"]) ** k * v(i, k + 1) for k in range(p["term"]))
    return value / unit, TOL


@check("FM_ANN_LEVEL_THEN_GROWTH_SOLVE_RATE")
def _(p):
    L, N, first, i = p["L"], p["N"], p["first"], p["i"]

    def pv(k):
        level = sum(L * v(i, first + t) for t in range(N))
        growing = sum(L * grown(k, i, m, first + N - 1 + m) for m in range(1, 6000))
        return level + growing

    return bisect(lambda k: pv(k) - p["PV"], 0.0, i - 1e-4) * 100, LOOSE


@check("FM_ANN_DEPOSITS_GIVEN_POWER")
def _(p):
    A, c, u, F = p["A"], p["c"], p["u"], p["F"]

    # Pick n so that (1+i)^n = u holds at each trial i, and sum the deposits.
    def gap(i):
        n = math.log(u) / math.log(1 + i)
        s_n = ((1 + i) ** n - 1) / i
        s_2n = ((1 + i) ** (2 * n) - 1) / i
        return A * s_n * (1 + i) ** (2 * n) + c * A * s_2n - F

    return bisect(gap, 1e-4, 1.0) * 100, LOOSE


@check("FM_ANN_MONTHLY_INCREASING_ANNUITY")
def _(p):
    m, j = p["m"], p["j"]
    r = (1 + j / m) ** (m / 12) - 1
    return sum(p["P"] * k * (1 + r) ** (-k) for k in range(1, 12 * p["years"] + 1)), TOL


@check("FM_ANN_INFLATION_INDEXED_CLAIMS")
def _(p):
    return sum(p["C"] * (1 + p["r"]) ** k * v(p["i"], k) for k in range(1, p["count"] + 1)), TOL


@check("FM_ANN_STEPPED_MONTHLY_RETIREMENT")
def _(p):
    r = p["j"] / 12
    return sum(p["M"] * (1 + p["g"]) ** (k // 12) * (1 + r) ** (-(k + 1)) for k in range(12 * p["years"])), TOL


@check("FM_ANN_DEFERRED_ARITHMETIC_LOAN")
def _(p):
    return sum((p["P"] + k * p["Q"]) * v(p["i"], p["first"] + k) for k in range(p["count"])), TOL


@check("FM_ANN_GROWING_DEPOSITS_AND_WITHDRAWALS")
def _(p):
    D, g, count, wcount, W = p["D"], p["g"], p["count"], p["wcount"], p["W"]

    def balance(i):
        fund = 0.0
        for k in range(count):
            fund = fund * (1 + i) + D * (1 + g) ** k
        return fund

    def withdrawals(i):
        return sum(W * (1 + g) ** k * v(i, k) for k in range(wcount))

    i = bisect(lambda r: balance(r) - withdrawals(r), 0.001, 0.3)
    return balance(i), LOOSE


@check("FM_ANN_GEOMETRIC_PERPETUITY_DUE_RATE")
def _(p):
    g = p["P2"] / p["P1"] - 1

    def price(i):
        q = (1 + i) ** 0.25 - 1
        return sum(p["P1"] * grown(g, q, k, k) for k in range(40000))

    return bisect(lambda i: price(i) - p["price"], 0.03, 0.5) * 100, LOOSE


@check("FM_ANN_SEMIANNUAL_INCREASING_PERPETUITY_RATE")
def _(p):
    L, Q = p["L"], p["Q"]

    def price(j):
        return sum((L + Q * max(0, k - 1)) * (1 + j) ** (-k) for k in range(20000))

    j = bisect(lambda r: price(r) - p["PV"], 0.005, 0.2)
    return ((1 + j) ** 2 - 1) * 100, LOOSE


@check("FM_ANN_ARITHMETIC_PERPETUITY")
def _(p):
    var = p["variant"]
    if var == "RATE":
        f = lambda i: sum((p["P"] + p["Q"] * k) * v(i, k + 1) for k in range(20000)) - p["PV"]
        return bisect(f, 0.005, 0.5) * 100, LOOSE
    if var == "FIRST":
        i = p["i"]
        return bisect(lambda P: sum((P + p["Q"] * k) * v(i, k + 1) for k in range(20000)) - p["PV"], -1e5, 1e5), LOOSE
    i = p["i"]
    first = 0 if var == "DUE" else 1
    return sum((p["P"] + p["Q"] * k) * v(i, first + k) for k in range(20000)), LOOSE


@check("FM_ANN_PROJECT_GROWING_OUTLAYS")
def _(p):
    i = p["i"]
    income = sum(p["income"] * v(i, t) for t in range(1, 8000))
    unit = sum((1 + p["g"]) ** t * v(i, t) for t in range(p["k"] + 1))
    return income / unit, LOOSE


@check("FM_ANN_LEVEL_THEN_GEOMETRIC_DUE_X")
def _(p):
    i, g, N = p["i"], p["g"], p["N"]
    unit = sum(grown(g, i, max(0, k - N + 1), k) for k in range(20000))
    return p["PV"] / unit, LOOSE


@check("FM_ANN_DECREASING_GEOMETRIC_PERPETUITY")
def _(p):
    var = p["variant"]
    if var == "FIRST":
        i = math.exp(p["delta"]) - 1
        unit = sum((1 - p["r"]) ** k * v(i, k + 1) for k in range(20000))
        return p["price"] / unit, LOOSE
    if var == "RATE":
        f = lambda r: sum(p["first"] * (1 - r) ** k * v(p["i"], k + 1) for k in range(20000)) - p["price"]
        return bisect(f, 0.0, 0.2) * 100, LOOSE
    wrong_unit = sum((1 - p["r"]) ** k * v(p["wrong"], k + 1) for k in range(20000))
    price = p["wrongPayment"] * wrong_unit
    unit = sum((1 - p["r"]) ** k * v(p["i"], k + 1) for k in range(20000))
    return price / unit, LOOSE


@check("FM_ANN_ARITHMETIC_DUE_TERM_CHANGE")
def _(p):
    i = math.exp(p["delta"]) - 1
    unit = lambda n: sum((k + 1) * v(i, k) for k in range(n))
    return p["price1"] * unit(p["n2"]) / unit(p["n1"]), TOL


@check("FM_ANN_MONTHLY_ARITHMETIC_ACCUMULATION")
def _(p):
    r = (1 + p["i"]) ** (1 / 12) - 1
    count = 12 * p["years"]
    return sum((p["first"] + k * p["step"]) * (1 + r) ** (count - 1 - k) for k in range(count)), TOL


@check("FM_ANN_ARITHMETIC_DECREASING_PAYMENTS")
def _(p):
    i = p["i"]
    f = lambda X: sum((X - p["step"] * k) * v(i, k + 1) for k in range(p["count"])) - p["invest"]
    return bisect(f, 0.0, 1e6), LOOSE


@check("FM_ANN_SCHOLARSHIP_SEMIANNUAL_STEPS")
def _(p):
    i = p["i"]
    return sum((p["P"] + p["Q"] * (k // 2)) * (1 + i) ** (-(k + 1) / 2) for k in range(40000)), LOOSE


@check("FM_ANN_GEOMETRIC_DEPOSITS_TARGET")
def _(p):
    fund = 0.0
    for k in range(p["count"]):
        fund = fund * (1 + p["i"]) + (1 + p["g"]) ** k
    return p["F"] / fund, TOL


@check("FM_ANN_ACCUMULATE_THEN_PERPETUITY_RATE")
def _(p):
    count = p["count"]
    if p["variant"] == "INCREASING":
        def fund(i):
            total = 0.0
            for k in range(1, count + 1):
                total = total * (1 + i) + k
            return total

        i = bisect(lambda r: fund(r) - p["P"] / r, 0.001, 1.0)
        return p["P"] / i, LOOSE

    def fund(i):
        total = 0.0
        for _ in range(count):
            total = total * (1 + i) + p["D"]
        return total

    i = bisect(lambda r: fund(r) - p["P"] / (p["mult"] * r), 0.001, 0.5)
    return fund(i), LOOSE


@check("FM_ANN_ARITHMETIC_SOLVE_INCREMENT")
def _(p):
    i = p["i"]
    f = lambda X: sum((p["first"] + X * k) * v(i, k + 1) for k in range(p["count"])) - p["price"]
    return bisect(f, -1e4, 1e5), LOOSE


@check("FM_ANN_GEOMETRIC_ANNUITY")
def _(p):
    i, count = p["i"], p["count"]
    if p["variant"] == "PV":
        return sum(p["first"] * (1 + p["g"]) ** k * v(i, k + 1) for k in range(count)), TOL
    unit = sum((1 + p["g"]) ** k * v(i, k + 1) for k in range(count))
    return p["PV"] / unit * (1 + p["g"]) ** (count - 1), TOL


@check("FM_ANN_TWO_PHASE_GEOMETRIC_PERPETUITY")
def _(p):
    A, K, g1, g2, i = p["A"], p["K"], p["g1"], p["g2"], p["i"]
    first = 0 if p["due"] else 1
    # Carry each discounted payment forward so nothing overflows.
    term = A * v(i, first)
    total = 0.0
    for k in range(1, 30000):
        total += term
        term *= (1 + (g1 if k < K else g2)) / (1 + i)
    return total, LOOSE


@check("FM_ANN_ARITHMETIC_PHASES_PERPETUITY")
def _(p):
    i = p["i"]
    payments = list(p["payments"]) + [p["tail"]] * 30000
    return pv_list(payments, i, 1), LOOSE


@check("FM_ANN_LEVEL_THEN_ARITHMETIC_PERPETUITY_K")
def _(p):
    N, Q, i = p["N"], p["Q"], p["i"]
    increments = sum(Q * max(0, t - N) * v(i, t) for t in range(1, 30000))
    level_unit = sum(v(i, t) for t in range(1, 30000))
    return (p["PV"] - increments) / level_unit, LOOSE


@check("FM_ANN_MONTHLY_ANNUAL_STEP_PERPETUITY")
def _(p):
    r = (1 + p["i"]) ** (1 / 12) - 1
    return sum(p["M"] * (1 + p["g"]) ** (k // 12) * (1 + r) ** (-(k + 1)) for k in range(12 * 1500)), LOOSE


@check("FM_ANN_ANNUAL_STEP_MONTHLY_DEPOSITS")
def _(p):
    r = p["j"] / 12
    months = 12 * p["years"]
    unit = 0.0
    for m in range(months):
        unit = (unit + (1 + p["g"]) ** (m // 12)) * (1 + r)
    first = p["AV"] / unit
    return first * (1 + p["g"]) ** (p["askYear"] - 1), TOL


@check("FM_ANN_PAIRED_ARITHMETIC_DUE")
def _(p):
    r = p["j"] / 12
    return sum((p["first"] + p["step"] * (k // 2)) * (1 + r) ** (-k) for k in range(p["count"])), TOL


@check("FM_ANN_DEFERRED_GEOMETRIC_MONTHLY")
def _(p):
    r = p["j"] / 12
    count = 12 * p["span"] + 1
    return sum(p["P"] * (1 + p["g"]) ** k * (1 + r) ** (-(12 * p["defer"] + k)) for k in range(count)), TOL


@check("FM_ANN_LUMP_SUMS_TO_INCREASING_PERPETUITY")
def _(p):
    i = p["i"]
    lumps = p["A"] + p["A"] * v(i, p["t2"])
    increments = sum(p["Q"] * k * v(i, k) for k in range(20000))
    unit = sum(v(i, k) for k in range(20000))
    return (lumps - increments) / unit, LOOSE


@check("FM_ANN_EVERY_K_YEARS_ARITHMETIC_PERPETUITY")
def _(p):
    k, i = p["k"], p["i"]
    if p["variant"] == "X":
        unit = sum((m + 1) * v(i, k * (m + 1)) for m in range(8000))
        return p["PV"] / unit, LOOSE
    return sum((p["first"] + p["inc"] * m) * v(i, k * (m + 1)) for m in range(8000)), LOOSE


@check("FM_ANN_LOTTERY_PERPETUITY_LATER_VALUE")
def _(p):
    Q, i, years = p["Q"], p["i"], p["years"]
    unit = sum(v(i, k) for k in range(20000))
    increments = sum(Q * k * v(i, k) for k in range(20000))
    P = (p["PV"] - increments) / unit
    return sum((P + Q * k) * v(i, k - years) for k in range(years + 1, years + 20000)), LOOSE


@check("FM_ANN_QUARTERLY_LEVEL_THEN_GROWING_AV")
def _(p):
    q = p["j"] / 4
    level = 4 * p["levelYears"]
    total = 4 * p["total"]
    fund, amount = 0.0, p["D"]
    for k in range(total):
        if k >= level:
            amount *= 1 + p["g"]
        fund = (fund + amount) * (1 + q)
    return fund, TOL


@check("FM_ANN_GROWING_ANNUITIES_EQUAL_VALUE")
def _(p):
    i = p["i"]
    pv_a = sum(p["A"] * (1 + p["gA"]) ** k * v(i, k + 1) for k in range(p["nA"]))
    unit_b = sum((1 + p["gB"]) ** k * v(i, k) for k in range(p["nB"]))
    return pv_a / unit_b, TOL


@check("FM_ANN_DECLINING_PAYMENTS_REINVESTED")
def _(p):
    fund, amount = 0.0, p["A"]
    for _ in range(p["count"]):
        fund = fund * (1 + p["j"]) + amount
        amount *= p["ratio"]
    return fund, TOL
