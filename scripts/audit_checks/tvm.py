"""Time value of money: independent re-derivations."""
import math

from .common import LOOSE, TOL, bisect, check, grow, integrate, solve_yield, v


@check("FM_TVM_NOMINAL_EQUALS_FORCE")
def _(p):
    # Growth over the stated term, read back as a constant force.
    growth = (1 + p["nominal"] / p["m"]) ** (p["m"] * p["years"])
    return math.log(growth) / p["years"], TOL


@check("FM_TVM_COMPOUND_SIMPLE_SAME_INTEREST")
def _(p):
    m, year = p["m"], p["year"]

    def gap(i):
        bal = grow(p["p1"], i / m, m * year - 1)
        return bal * (i / m) - p["p2"] * i / m

    return bisect(gap, 1e-4, 1.0) * 100, LOOSE


@check("FM_TVM_INTEREST_IN_YEAR_EQUAL")
def _(p):
    def interest(deposit, year, i):
        return grow(deposit, i, year - 1) * i

    i = bisect(lambda r: interest(p["deposit"], p["early"], r) - interest(p["smaller"], p["late"], r), 1e-4, 1.0)
    return interest(p["deposit"], p["early"], i), LOOSE


@check("FM_TVM_POWER_FORCE_INTEREST_EQUATION")
def _(p):
    force = lambda t: t ** p["power"] / p["divisor"]
    aT = math.exp(integrate(force, 0, p["T"]))
    R = math.exp(integrate(force, p["T"], p["H"]))
    # (deposit*a(T) + X)(R - 1) = k X
    return p["deposit"] * aT * (R - 1) / (p["k"] - (R - 1)), LOOSE


@check("FM_TVM_RATIONAL_FORCE_TIME_TO_TARGET")
def _(p):
    force = lambda t: (t * t / p["A"]) / (p["B"] + t ** 3 / p["C"])
    target = math.log(p["target"] / p["deposit"])
    return bisect(lambda t: integrate(force, 0, t, 2000) - target, 0.01, 200, 80), LOOSE


@check("FM_TVM_DISCOUNT_THEN_NOMINAL_SOLVE")
def _(p):
    m1, m2, j = p["m1"], p["m2"], p["j"]

    def balance(d):
        first = grow(p["d1"], 0, 0) * (1 - d / m1) ** (-m1 * p["T1"])
        first = grow(first, j / m2, m2 * (p["H"] - p["T1"]))
        second = grow(p["d2"], j / m2, m2 * (p["H"] - p["s"]))
        return first + second - p["balance"]

    return bisect(balance, 1e-5, 0.5) * 100, LOOSE


@check("FM_TVM_PIECEWISE_FORCE_LOAN")
def _(p):
    later = math.exp(integrate(lambda t: 1 / (p["c"] + t), p["T"], p["H"]))
    early = (1 + p["i"]) ** p["T"]
    return (p["repayment"] / later - p["L0"] * early) / (1 + p["i"]) ** (p["T"] - p["s"]), LOOSE


@check("FM_TVM_INTEREST_AND_DISCOUNT_FUNDS")
def _(p):
    m, n = p["m"], p["m"] * p["T"]
    k = bisect(lambda k: grow(1000, k / m, n) - p["depositY"] * (1 - k / m) ** (-n), 1e-4, m * 0.9)
    return grow(1000, k / m, n), LOOSE


@check("FM_TVM_FORCE_YEAR_EFFECTIVE_RATE")
def _(p):
    c, k = p["c"], p["k"]
    force = (lambda t: 1 / (c + t)) if p["reciprocal"] else (lambda t: 2 * t / (c + t * t))
    return (math.exp(integrate(force, k - 1, k)) - 1) * 100, LOOSE


@check("FM_TVM_REAL_RATE")
def _(p):
    r = p["inflation"]
    if "deposit" in p:
        money = grow(p["deposit"], p["nominalRate"], p["years"])
        prices = grow(1.0, r, p["years"])
        return money / prices, LOOSE
    if "real" in p:
        return ((1 + p["real"]) * (1 + r) - 1) * 100, TOL
    return ((1 + p["nominalRate"]) / (1 + r) - 1) * 100, TOL


@check("FM_TVM_RATE_REGIMES_ACCUMULATION")
def _(p):
    value = p["deposit"]
    for rate, years, kind, m in zip(p["rates"], p["years"], p["kinds"], p["m"]):
        if kind == "NOMINAL":
            value = grow(value, rate / m, m * years)
        elif kind == "FORCE":
            value *= math.exp(rate * years)
        else:
            for _ in range(m * years):
                value /= 1 - rate / m
    return value, TOL


@check("FM_TVM_INTEREST_RATIO_TWO_YEARS")
def _(p):
    m = p["m"]

    def interest_in(year, i):
        start = grow(p["deposit"], i / m, m * (year - 1))
        return grow(start, i / m, m) - start

    return bisect(lambda i: interest_in(p["late"], i) - p["k"] * interest_in(p["early"], i), 1e-4, 1.0) * 100, LOOSE


@check("FM_TVM_SIMPLE_VS_COMPOUND_YEAR_INTEREST")
def _(p):
    m, year = p["m"], p["year"]
    start = grow(1000, p["j"] / m, m * (year - 1))
    compound = grow(start, p["j"] / m, m) - start
    simple = 1000 * (p["r1"] if year <= p["T"] else p["r2"])
    return abs(compound - simple), TOL


@check("FM_TVM_TIME_TO_EQUAL_BALANCES")
def _(p):
    m = p["m"]
    fx = lambda t: p["small"] * (1 - p["d"] / m) ** (-m * t)
    fy = lambda t: p["big"] * math.exp(p["delta"] * t)
    return bisect(lambda t: fx(t) - fy(t), 0.0, 200.0), LOOSE


@check("FM_TVM_MONTHS_UNTIL_DOUBLE")
def _(p):
    lucas, danielle = p["deposit"], p["deposit"]
    for month in range(1, 2000):
        danielle *= 1 + p["j2"] / 12
        if month % 6 == 0:
            lucas *= 1 + p["j1"] / 2
        if lucas >= 2 * danielle:
            return month, TOL
    return -1, TOL


@check("FM_TVM_STREAMS_GIVEN_VN")
def _(p):
    left = p["a"] + p["b"] * p["x"] + p["c"] * p["x"] ** 2
    return bisect(lambda i: p["S"] * v(i, p["T"]) - left, 1e-5, 1.0) * 100, LOOSE


@check("FM_TVM_NPV_EQUAL_PROJECTS")
def _(p):
    i = p["i"]
    npv_p = -p["A"] + p["B"] * v(i, 1) + p["C"] * v(i, 2)
    return bisect(lambda X: p["D"] + p["E"] * v(i, 1) - X * v(i, 2) - npv_p, -1e7, 1e7), LOOSE


@check("FM_TVM_TWO_RATES_SAME_PV")
def _(p):
    f = lambda r: p["A"] + p["C"] * v(r, 2) - p["B"] * v(r, 1)
    # Scan for the two sign changes, then refine each.
    roots, grid = [], [k / 2000 + 1e-7 for k in range(1, 800)]
    for a, b in zip(grid, grid[1:]):
        if f(a) * f(b) < 0:
            roots.append(bisect(f, a, b))
    return abs(roots[1] - roots[0]) * 100, LOOSE


@check("FM_TVM_BONUS_CD_EQUIVALENT")
def _(p):
    target = grow(1.0, p["i"], p["years"]) + p["bonus"]
    return bisect(lambda j: grow(1.0, j, p["years"]) - target, 0.0, 1.0) * 100, LOOSE


@check("FM_TVM_EARLY_WITHDRAWAL_PENALTY")
def _(p):
    kept = (1 + p["i"]) ** (p["years"] - p["forfeit"] / 12)
    return bisect(lambda j: grow(1.0, j, p["years"]) - kept, 0.0, 1.0) * 100, LOOSE


@check("FM_TVM_EARLY_PAYMENT_DISCOUNT")
def _(p):
    t = (p["late"] - p["early"]) / 365
    if "deposit" not in p:
        return ((1 / (1 - p["discount"])) ** (1 / t) - 1) * 100, LOOSE
    f = lambda X: (1 - p["discount"]) * X - p["deposit"] - (X - p["deposit"]) * v(p["i"], t)
    return bisect(f, p["deposit"] * 1.0001, 1e7), LOOSE


@check("FM_TVM_CURRENT_VALUE_TRANSACTIONS")
def _(p):
    d = p["delta"]
    X = p["price"] * math.exp(-d * p["later2"] / 12) - p["cv2"]
    return -X * math.exp(d * p["ago"] / 12) + p["price"] * math.exp(-d * p["later1"] / 12), LOOSE


@check("FM_TVM_EQUIVALENT_DISCOUNT_OVER_TERM")
def _(p):
    growth = grow(1.0, p["i"], p["T1"]) * math.exp(integrate(lambda t: 1 / (p["c"] + t), p["T1"], p["H"]))
    if p["askDiscount"]:
        return bisect(lambda d: (1 - d) ** (-p["H"]) - growth, 0.0, 0.9) * 100, LOOSE
    return bisect(lambda i: (1 + i) ** p["H"] - growth, 0.0, 1.0) * 100, LOOSE


@check("FM_TVM_LINEAR_FORCE_DEPOSITS")
def _(p):
    force = lambda t: p["a"] + p["b"] * t
    horizon = p["count"]
    return sum(p["deposit"] * math.exp(integrate(force, s, horizon)) for s in range(p["count"])), LOOSE


@check("FM_TVM_FORCE_THEN_DISCOUNT_EQUIVALENT")
def _(p):
    X = p["amount"] * math.exp(integrate(lambda t: p["p"] / (p["q"] + p["p"] * t), p["t1"], p["t2"]))
    Y = X
    for _ in range(p["m"] * p["years"]):
        Y *= 1 - p["d"] / p["m"]
    return Y, LOOSE


@check("FM_TVM_YIELD_TWO_RATE_DEPOSITS")
def _(p):
    # Year-by-year fund ledger with deposits at the start of the relevant years.
    deposits = {k * p["gap"]: p["deposit"] for k in range(p["count"])}
    fund = 0.0
    for year in range(p["horizon"]):
        fund += deposits.get(year, 0.0)
        fund *= 1 + (p["i1"] if year < p["T1"] else p["i2"])
    flows = [(t, -a) for t, a in deposits.items()] + [(p["horizon"], fund)]
    return solve_yield(flows, -0.5, 1.0) * 100, LOOSE


@check("FM_TVM_COMBINED_YIELD_DIFFERENCE")
def _(p):
    A, B, C, r = p["A"], p["B"], p["C"], p["r"]
    X = solve_yield([(0, -A), (2, B)])
    Z = bisect(lambda z: -(A + C) - C * v(r, 1) + (B + z) * v(r, 2), 0.0, 1e7)
    Y = solve_yield([(0, -C), (1, -C), (2, Z)])
    return (Y - X) * 100, LOOSE
