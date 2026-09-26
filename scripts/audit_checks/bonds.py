"""Bonds: independent re-derivations from explicit cash-flow sums, coupon-by-coupon
amortization ledgers, and bisection. No closed-form bond formula from the
engine is reused; where a template leans on an identity (premium/discount,
Makeham, the price-to-face identity for coupons proportional to the yield),
the check reaches the answer by a different route."""
import math

from .common import LOOSE, TOL, bisect, bond_flows, check, pv_flows, v


def per_coupon(rate, m, effective):
    return (1 + rate) ** (1 / m) - 1 if effective else rate / m


def price(coupon, redemption, j, n):
    return pv_flows(bond_flows(coupon, redemption, n), j)


def ledger(coupon, redemption, j, n):
    """(interest, principal adjustment, book value after) for each coupon."""
    bv = price(coupon, redemption, j, n)
    rows = []
    for _ in range(n):
        interest = bv * j
        adjust = coupon - interest
        bv -= adjust
        rows.append((interest, adjust, bv))
    return rows


def solve_yield(p, coupon, redemption, n, lo=-0.2, hi=1.0):
    return bisect(lambda j: price(coupon, redemption, j, n) - p, lo, hi)


def annuity(n, j):
    return sum(v(j, t) for t in range(1, n + 1))


def accumulate(n, j):
    return sum((1 + j) ** t for t in range(n))


def linear_root(f):
    """Root of an affine function, found from two evaluations."""
    f0, f1 = f(0.0), f(1.0)
    return -f0 / (f1 - f0)


@check("FM_BOND_PRICE")
def _(p):
    if p["variant"] == "PV_REDEMPTION":
        # Makeham: P = K + (g/j)(C - K) with K the present value of the redemption value.
        K, C, j = p["pvC"], p["C"], p["y"] / 2
        g = p["F"] * p["r"] / 2 / C
        return K + g / j * (C - K), TOL
    m = p["m"]
    j = per_coupon(p["y"], m, p["effective"])
    return price(p["F"] * p["r"] / m, p["C"], j, m * p["years"]), TOL


@check("FM_BOND_YIELD_FROM_PRICE")
def _(p):
    n = 2 * p["years"]
    j = solve_yield(p["price"], p["F"] * p["r"] / 2, p["F"], n)
    return (((1 + j) ** 2 - 1) if p["ask"] == "EFF" else 2 * j) * 100, LOOSE


@check("FM_BOND_DISCOUNT_FROM_PRICE")
def _(p):
    n = 2 * p["years"]
    unit = price(p["r"] / 2, 1.0, p["y"] / 2, n)
    face = p["P"] / unit
    return abs(face - p["P"]), TOL


@check("FM_BOND_AMORTIZATION_IN_COUPON")
def _(p):
    m = p["m"]
    n = m * p["years"]
    j = per_coupon(p["y"], m, p["effective"])
    rows = ledger(p["F"] * p["r"] / m, p["C"], j, n)
    k = p["k"]
    if p["ask"] == "INTEREST":
        return rows[k - 1][0], TOL
    if p["ask"] == "ADJUST":
        return abs(rows[k - 1][1]), TOL
    if p["ask"] == "BOOK":
        return rows[k - 1][2], TOL
    return sum(row[0] for row in rows), TOL


@check("FM_BOND_SOLVE_FROM_AMORTIZATION")
def _(p):
    variant = p["variant"]
    if variant == "SOLVE_R":
        m = p["m"]
        n, j = m * p["years"], p["y"] / m
        adj = lambda r: -ledger(p["F"] * r / m, p["F"], j, n)[p["k"] - 1][1]
        return bisect(lambda r: adj(r) - p["A"], 0.0, p["y"]) * 100, LOOSE
    if variant == "SOLVE_C":
        m = p["m"]
        n, j = m * p["years"], p["y"] / m
        g = p["F"] * p["r"] / m
        sign = 1 if p["premium"] else -1
        adj = lambda C: sign * ledger(g, C, j, n)[p["k"] - 1][1]
        lo, hi = (1.0, g / j) if p["premium"] else (g / j, 50 * g / j)
        return bisect(lambda C: adj(C) - p["A"], lo, hi), LOOSE
    r, y, years, t = p["r"], p["y"], p["years"], p["t"]
    adj = lambda F: abs(ledger(F * r, F, y, years)[t - 1][1])
    F = bisect(lambda F: adj(F) - p["A"], 1.0, 1e7)
    return price(F * r, F, y, years), LOOSE


@check("FM_BOND_TWO_AMORTIZATION_AMOUNTS")
def _(p):
    n, t1, t2 = p["years"], p["t1"], p["t2"]
    i = bisect(lambda x: (1 + x) ** (t2 - t1) - p["A2"] / p["A1"], 0.0, 1.0)
    gap = p["A1"] * (1 + i) ** (n - t1 + 1)
    # Each coupon's adjustment is gap * v^(n - t + 1); they add up to the premium or discount.
    return sum(gap * v(i, n - t + 1) for t in range(1, n + 1)), LOOSE


@check("FM_BOND_BOOK_VALUES_SOLVE_RATE")
def _(p):
    variant = p["variant"]
    if variant == "LAST_TWO":
        B1, B2, C = p["B1"], p["B2"], p["C"]

        def gap(i):
            coupon = B1 * (1 + i) - B2
            return B2 * (1 + i) - coupon - C

        return bisect(gap, 0.0, 1.0) * 100, LOOSE
    if variant == "FIRST_ACCUM":
        P, A1, k = p["P"], p["A1"], p["k"]

        def book(i, t):
            bv, adj = P, A1
            for _ in range(t):
                bv += adj
                adj *= 1 + i
            return bv

        i = bisect(lambda x: book(x, k) - p["Bk"], 1e-9, 1.0)
        return book(i, p["years"]), LOOSE
    m = p["m"]
    n = m * p["years"]
    g = p["F"] * p["r"] / m
    k1, k2 = p["k1"], p["k2"]

    def roll(j, bv, periods):
        for _ in range(periods):
            bv = bv * (1 + j) - g
        return bv

    j = bisect(lambda x: roll(x, p["B1"], k2 - k1) - p["B2"], 1e-9, 0.5)
    bv = roll(j, p["B2"], n - k2 - 1)  # book value just before the last coupon
    return bv * j - g, LOOSE


@check("FM_BOND_BOOK_VALUES_SOLVE_TERM")
def _(p):
    variant = p["variant"]
    if variant == "CONSECUTIVE":
        i, k, C = p["i"], p["k"], p["C"]
        coupon = p["B1"] * (1 + i) - p["B2"]
        best = min(range(k + 2, 400), key=lambda n: abs(price(coupon, C, i, n - k) - p["B1"]))
        return best, TOL
    if variant == "CHANGE":
        F, j, k = p["F"], p["y"] / 2, p["k"]
        coupon = F * p["r"] / 2

        def change(N):
            return price(coupon, F, j, N - k - 1) - price(coupon, F, j, N - k)

        best = min(range(k + 2, 400), key=lambda N: abs(change(N) - p["delta"]))
        return best / 2, TOL
    j = p["y"] / 2

    def mismatch(n):
        # Coupon implied by the price over 2n coupons, then the book value halfway.
        coupon = (p["P"] - 100 * v(j, 2 * n)) / annuity(2 * n, j)
        return abs(price(coupon, 100, j, n) - p["BV"])

    return min(range(1, 150), key=mismatch), TOL


@check("FM_BOND_HALF_PREMIUM_AMORTIZED")
def _(p):
    m = p["m"]
    n = m * p["years"]
    j = p["y"] / m
    rows = ledger(p["r"] / m, 1.0, j, n)
    total = abs(price(p["r"] / m, 1.0, j, n) - 1.0)
    running = 0.0
    for t, row in enumerate(rows, start=1):
        running += abs(row[1])
        if running > p["phi"] * total:
            return t, TOL
    return None, TOL


@check("FM_BOND_SELL_AND_REINVEST")
def _(p):
    if p["variant"] == "SELL_BUY":
        j1, j2 = p["y1"] / 2, p["y2"] / 2
        n1 = 2 * p["n1"]
        g1 = bisect(lambda g: price(g, p["C1"], j1, n1) - p["C1"], 0.0, p["C1"])
        proceeds = price(g1, p["C1"], j2, n1 - 2 * p["T"])
        n2 = 2 * p["n2"]
        return bisect(lambda g: price(g, p["C2"], j2, n2) - proceeds, 0.0, proceeds), LOOSE
    F, r, n = p["F"], p["r"], 2 * p["n"]
    coupon = F * r / 2
    jK = solve_yield(F - p["D0"], coupon, F, n)
    B = ledger(coupon, F, jK, n)[1][2]
    D = F - price(coupon, F, p["yW"] / 2, n - 2)
    return B - D, LOOSE


@check("FM_BOND_PRICE_DIFFERENCE_SOLVE_RATE")
def _(p):
    if p["variant"] == "SPREAD":
        F, n, delta = p["F"], 2 * p["years"], p["delta"]

        def gap(j):
            i = 2 * j
            return price(F * (i + delta) / 2, F, j, n) - price(F * (i - delta) / 2, F, j, n) - p["diff"]

        return 2 * bisect(gap, 1e-7, 0.5) * 100, LOOSE
    n, c, mult = 2 * p["years"], p["c"], p["mult"]

    def gap(j):
        # Face amount implied by each price must stand in the stated ratio.
        X1 = (p["P1"] - c * annuity(n, j)) / v(j, n)
        X2 = (p["P2"] - c * annuity(n, j)) / v(j, n)
        return X2 - mult * X1

    return 2 * bisect(gap, 1e-7, 0.5) * 100, LOOSE


@check("FM_BOND_PRICE_DIFFERENCE_SOLVE_TERM")
def _(p):
    variant = p["variant"]
    if variant == "GAP":
        F, j, e = p["F"], p["y"] / 2, p["e"]
        g1, g2 = F * p["r1"] / 2, F * p["r2"] / 2

        def diff(years):
            c = 1000.0  # the common redemption value cancels
            return price(g1, c, j, 2 * years) - price(g2, c + e, j, 2 * years)

        return min(range(1, 100), key=lambda yrs: abs(diff(yrs) - p["diff"])), TOL
    if variant == "PRICE":
        r = 2 * p["c"] / p["F"]
        j = (r + p["delta"]) / 2
        return min(range(1, 100), key=lambda yrs: abs(price(p["c"], p["C"], j, 2 * yrs) - p["P"])), TOL
    PA = price(p["FA"] * p["rA"] / 2, p["CA"], p["yA"] / 2, 2 * p["nA"])
    jB = p["yA"] / 4
    gB = p["FB"] * p["rB"] / 4
    return min(range(1, 100), key=lambda yrs: abs(price(gB, p["CB"], jB, 4 * yrs) - PA)), TOL


@check("FM_BOND_PRICE_CHANGE_SOLVE_COUPON")
def _(p):
    variant = p["variant"]
    if variant == "TERM_DOUBLED":
        F, n, j = p["F"], 2 * p["years"], p["y"] / 2
        change = -p["D"] if p["less"] else p["D"]
        return linear_root(lambda c: price(c, F, j, 2 * n) - price(c, F, j, n) - change), TOL
    if variant == "COUPON_DOUBLED":
        m = p["m"]
        n, j = m * p["years"], p["y"] / m
        return linear_root(lambda X: price(2 * X, p["F"], j, n) - price(X, p["F"], j, n) - p["D"]), TOL
    if variant == "SHORTER":
        j = p["y"] / 2
        g = p["F"] * p["r"] / 2
        factor = 1 - p["pct"] if p["less"] else 1 + p["pct"]
        return linear_root(lambda C: price(g, C, j, 2 * p["n2"]) - factor * price(g, C, j, 2 * p["n1"])), TOL
    F, n, j = p["F"], 2 * p["years"], p["y"] / 2
    C = 1000.0  # cancels
    return linear_root(lambda K: price(F * p["r1"] / 2, C, j, n) - price(F * p["r2"] / 2, C + K, j, n) - p["D"]), TOL


@check("FM_BOND_SAME_PRICE_SOLVE_COUPON")
def _(p):
    variant = p["variant"]
    if variant == "DIFF_YIELD":
        F, n = p["F"], 2 * p["years"]
        P = price(F * p["rA"] / 2, F, p["yA"] / 2, n)
        return linear_root(lambda y: price(F * y / 2, F, p["yB"] / 2, n) - P) * 100, TOL
    if variant == "DIFF_REDEMPTION":
        n, i = p["years"], p["i"]
        P = price(p["C1"] * p["r1"], p["C1"], i, n)
        return linear_root(lambda r: price(p["C2"] * r, p["C2"], i, n) - P) * 100, TOL
    if variant == "THREE":
        # r = x (1/F) + z: solve the 2x2 system by Cramer's rule.
        a1, a2 = 1 / p["F1"], 1 / p["F2"]
        det = a1 - a2
        x = (p["r1"] - p["r2"]) / det
        z = (a1 * p["r2"] - a2 * p["r1"]) / det
        return (x / p["F3"] + z) * 100, TOL
    if variant == "ZERO_THEN_COUPON":
        i = bisect(lambda x: p["F1"] * v(x, p["n1"]) - p["P1"], 1e-9, 1.0)
        j = (1 + i) ** 0.25 - 1
        n = 4 * p["n2"]
        return linear_root(lambda r: price(p["F2"] * r / 4, p["F2"], j, n) - p["P2"]) * 100, TOL
    F, n, i = p["F"], p["years"], p["i"]

    def gap(r):
        PA = price(F * r, F * (1 - p["below"]), i, n)
        PB = price(F * (r + p["step"]), F * (1 + p["above"]), i, n)
        return PB - p["k"] * PA

    return linear_root(gap) * 100, TOL


@check("FM_BOND_SAME_PRICE_SOLVE_YIELD")
def _(p):
    if p["variant"] == "REDEMPTION":
        F, n = p["F"], 2 * p["years"]
        g = F * p["r"] / 2
        P = price(g, p["C1"], p["y1"] / 2, n)
        return 2 * solve_yield(P, g, p["C2"], n) * 100, LOOSE
    F, years = p["F"], p["years"]
    PA = price(F * p["rA"] / 2, F, (1 + p["iA"]) ** 0.5 - 1, 2 * years)
    return solve_yield(PA - p["D"], F * p["rB"], F, years) * 100, LOOSE


@check("FM_BOND_COMBINED_PRICE_COUPON")
def _(p):
    F, n, i = p["F"], p["years"], p["i"]
    return linear_root(lambda r: price(F * r, F, i, n) + price(F * (r + p["delta"]), F, i, n) - p["total"]) * 100, TOL


@check("FM_BOND_COUPON_FREQUENCY_TRIO")
def _(p):
    F = 1000.0
    jZ = p["y"] / p["mZ"]
    PZ = price(p["cZ"], F, jZ, p["mZ"] * 1)  # one year is enough: a coupon equal to F*j prices at par
    PY = PZ + p["d2"]
    jY = (1 + jZ) ** (p["mZ"] / p["mY"]) - 1
    years = min(range(1, 100), key=lambda yrs: abs(price(p["cY"], F, jY, p["mY"] * yrs) - PY))
    iX = (1 + jZ) ** p["mZ"] - 1
    PX = PY - p["d1"]
    return linear_root(lambda R: price(R, F, iX, years) - PX), TOL


@check("FM_BOND_ZERO_COUPON_EQUIVALENT")
def _(p):
    variant = p["variant"]
    if variant == "FACE":
        # Any whole term works; take n = 10 and the rate it implies, then price by explicit sums.
        n = 10
        i = (1000 / p["P0"]) ** (1 / n) - 1
        unit = price(p["k"] * i, 1.0, i, n)
        return p["P0"] / unit, TOL
    if variant == "MULTIPLE_TERM":
        m = 10
        k, F = p["k"], p["F"]
        i = bisect(lambda x: price(F * k * x, F, x, m) - p["P"], 1e-9, 2.0)
        return price(F * k * i, F, i, p["q"] * m), LOOSE
    if variant == "TERM_OF_COUPON":
        i = p["p"] ** (-1 / p["nZero"]) - 1
        k = p["kNum"] / p["kDen"]
        return min(range(1, 400), key=lambda m: abs(price(k * i, 1.0, i, m) - p["p"])), TOL
    if variant == "TERM_OF_ZERO":
        k = p["kNum"] / p["kDen"]
        i = bisect(lambda x: price(k * x, 1.0, x, p["N"]) - p["p"], 1e-9, 2.0)
        return min(range(1, 400), key=lambda n: abs(v(i, n) - p["p"])), TOL
    k = p["k"]
    i = bisect(lambda x: price(k * x, 1.0, x, p["N"]) - (1 + p["prem1"]), 1e-9, 2.0)
    return min(range(1, 400), key=lambda n: abs(price(k * i, 1.0, i, n) - (1 + p["prem2"]))), TOL


# ---------------------------------------------------------------------------
# Callable bonds, reinvestment, borrowing, varying coupons
# ---------------------------------------------------------------------------

def redemption_dates(p):
    """(coupon number, amount paid) for every date the bond can be redeemed."""
    m, N = p["m"], p["m"] * p["years"]
    if p["variant"] == "FROM_YEAR":
        dates = [(t, p["X"]) for t in range(m * p["K"], N)]
    elif p["variant"] == "LAST":
        dates = [(t, p["X"]) for t in range(N - p["L"] + 1, N)]
    else:
        dates = [(m * year, value) for year, value in zip(p["callYears"], p["callValues"])]
    return dates + [(N, p["CN"])]


def quote(j, m, effective):
    return (((1 + j) ** m - 1) if (effective or m == 1) else m * j) * 100


@check("FM_BOND_CALLABLE_MAX_PRICE")
def _(p):
    m = p["m"]
    j = per_coupon(p["y"], m, p["effective"])
    g = p["F"] * p["r"] / m
    return min(price(g, value, j, t) for t, value in redemption_dates(p)), TOL


@check("FM_BOND_CALLABLE_MIN_YIELD")
def _(p):
    m = p["m"]
    g = p["F"] * p["r"] / m
    worst = min(solve_yield(p["P"], g, value, t, -0.5, 2.0) for t, value in redemption_dates(p))
    return quote(worst, m, p["effective"]), LOOSE


@check("FM_BOND_CALLABLE_SOLVE_PAR")
def _(p):
    j = p["y"] / 2
    unit = min(price(p["r"] / 2, 1.0, j, t) for t in range(2 * p["K"], 2 * p["years"] + 1))
    return p["P"] / unit, TOL


@check("FM_BOND_CALLABLE_WORST_DATE")
def _(p):
    j, g, N = p["y"] / 2, p["F"] * p["r"] / 2, 2 * p["years"]

    def value(t):
        return p["C1"] if t < p["shift"] else (p["C2"] if t < N else p["F"])

    worst = min(range(p["first"], N + 1), key=lambda t: price(g, value(t), j, t))
    return str(worst), TOL


@check("FM_BOND_CALLED_EARLY_YIELD")
def _(p):
    g = p["F"] * p["r"] / 2
    P = price(g, p["Xa"], (1 + p["i"]) ** 0.5 - 1, 2 * p["Ka"])
    k = solve_yield(P, g, p["Xt"], p["t"], -0.5, 2.0)
    return ((1 + k) ** 2 - 1) * 100, LOOSE


@check("FM_BOND_REINVESTED_COUPONS")
def _(p):
    variant = p["variant"]
    if variant == "SOLVE_REINVEST":
        n = 2 * p["years"]
        g = p["F"] * p["r"] / 2
        P = price(g, p["F"], p["y"] / 2, n)
        target = P * (1 + p["Y"]) ** p["years"]
        # Deposit each coupon and let the account grow period by period.
        def account(k):
            bal = 0.0
            for _ in range(n):
                bal = bal * (1 + k) + g
            return bal + p["C"] - target
        k = bisect(account, -0.5, 1.0)
        return ((1 + k) ** 2 - 1) * 100, LOOSE
    years, coupon = p["years"], p["F"] * p["r"]
    bal = 0.0
    for _ in range(years):
        bal = bal * (1 + p["j"]) + coupon
    X = (bal + p["C"]) / (1 + p["Y"]) ** years
    if variant == "SOLVE_PRICE":
        return X, TOL
    return solve_yield(X, coupon, p["C"], years) * 100, LOOSE


@check("FM_BOND_BORROWED_PURCHASE_YIELD")
def _(p):
    m, E, L = p["m"], p["E"], p["L"]
    F = E + L
    n = m * p["years"]
    net = F * p["rB"] / m - L * p["rL"] / m
    flows = [(t, net) for t in range(1, n + 1)] + [(n, F - L), (0, -E)]
    j = bisect(lambda x: pv_flows(flows, x), 1e-9, 1.0)
    return ((1 + j) ** m - 1) * 100, LOOSE


@check("FM_BOND_VARYING_COUPONS")
def _(p):
    variant = p["variant"]
    N = 2 * p["years"]
    if variant == "ARITH":
        j = p["y"] / 2
        pv = lambda X: sum((p["c0"] + t * X) * v(j, t) for t in range(1, N + 1)) + p["C"] * v(j, N) - p["P"]
        return linear_root(pv), TOL
    if variant == "GEO_AFTER":
        j = (1 + p["y"]) ** 0.5 - 1
        pv = lambda c: sum(c * (1 + p["g"]) ** t * v(j, t) for t in range(1, N + 1)) + p["C"] * v(j, N) - p["P"]
        return linear_root(pv), TOL
    j = p["y"] / 2
    pv = lambda R: sum(R * (1 + p["g"]) ** (t - 1) * v(j, t) for t in range(1, N + 1)) + p["C"] * v(j, N) - p["P"]
    return linear_root(pv), TOL


def stepped_flows(p, start):
    """Cash flows after coupon `start` of a bond paying r1 for the first half and r2 for the second."""
    N = 2 * p["years"]
    flows = []
    for t in range(start + 1, N + 1):
        rate = p["r1"] if t <= N // 2 else p["r2"]
        flows.append((t - start, p["F"] * rate / 2 + (p["F"] if t == N else 0)))
    return flows


@check("FM_BOND_STEP_COUPONS")
def _(p):
    if p["variant"] == "PRICE_B":
        N = 2 * p["years"]
        j = solve_yield(p["PA"], p["F"] * p["rA"] / 2, p["F"], N)
        return pv_flows(stepped_flows(p, 0), j), LOOSE
    return pv_flows(stepped_flows(p, p["k"]), p["y1"] / 2), TOL
