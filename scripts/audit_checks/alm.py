"""General cash flows, the term structure, duration and immunization:
independent re-derivations from explicit sums, simulated accounts, bisection
and small linear solves. Durations are computed from their definitions (time
weighted present values), never from the closed forms the engine uses."""
from .common import LOOSE, TOL, bisect, check, pv_flows, v


def spot_pv(flows, spots):
    return sum(a / (1 + spots[t - 1]) ** t for t, a in flows)


def bond_list(coupon, face, n):
    return [(t, coupon + (face if t == n else 0)) for t in range(1, n + 1)]


def pct_text(rate):
    """A rate printed as the engine prints it: 0.15 -> '15%', 0.0725 -> '7.25%'."""
    text = f"{rate * 100:.2f}".rstrip("0").rstrip(".")
    return f"{text}%"


@check("FM_ALM_PRICE_FROM_SPOTS")
def _(p):
    if p["variant"] == "BOND":
        flows = bond_list(p["F"] * p["r"], p["F"], len(p["spots"]))
    else:
        flows = [(t + 1, a) for t, a in enumerate(p["amounts"])]
    return spot_pv(flows, p["spots"]), TOL


@check("FM_ALM_YIELD_FROM_SPOTS")
def _(p):
    n = len(p["spots"])
    flows = bond_list(p["F"] * p["r"], p["F"], n) if p["variant"] == "BOND" else [(t, 1.0) for t in range(1, n + 1)]
    value = spot_pv(flows, p["spots"])
    return bisect(lambda y: pv_flows(flows, y) - value, -0.5, 2.0) * 100, LOOSE


@check("FM_ALM_FORWARD_RATE")
def _(p):
    variant = p["variant"]
    if variant == "SPOT_FROM_FORWARDS":
        term = p["term"]
        grown = 1.0
        for f in p["forwards"][:term]:
            grown *= 1 + f
        return bisect(lambda s: (1 + s) ** term - grown, -0.5, 1.0) * 100, LOOSE
    if variant == "ZERO_PRICES":
        k, prices = p["k"], p["prices"]
        # Buy 1/P_{k+1} bonds maturing at k+1 with the proceeds of one bond maturing at k.
        return (prices[k - 1] / prices[k] - 1) * 100, TOL
    spots = p["spots"]
    k = p["k"]
    m = 1 if variant == "ONE_YEAR" else p["m"]
    early = (1 + spots[k - 1]) ** k
    late = (1 + spots[k + m - 1]) ** (k + m)
    return bisect(lambda f: early * (1 + f) ** m - late, -0.5, 1.0) * 100, LOOSE


@check("FM_ALM_ZERO_PRICE_SAVINGS")
def _(p):
    per_unit = sum(100.0 / price for price in p["prices"])
    return p["target"] / per_unit, TOL


@check("FM_ALM_NPV")
def _(p):
    i = p["i"]
    if p["variant"] == "PLAIN":
        flows = [(0, -p["I0"]), (1, -p["I1"]), (2, -p["I2"])] + [(t, p["R"]) for t in range(1, p["years"] + 1)]
        return pv_flows(flows, i), TOL
    bal = 0.0
    for t in range(1, p["years"] + 1):
        bal = bal * (1 + p["r"]) + (p["C"] if t >= p["first"] else 0.0)
    return -p["P"] + bal * v(i, p["years"]), TOL


@check("FM_ALM_PROJECT_SELECTION")
def _(p):
    names = ["A", "B", "C"]
    npvs = [-p["I"] + sum(a * v(p["i"], t + 1) for t, a in enumerate(p[name])) for name in names]
    positive = sorted([k for k in range(3) if npvs[k] > 0], key=lambda k: -npvs[k])[: p["limit"]]
    chosen = sorted(positive)
    if not chosen:
        return "None of the projects", TOL
    if len(chosen) == 1:
        return f"Project {names[chosen[0]]} only", TOL
    return "Projects " + " and ".join(names[k] for k in chosen), TOL


@check("FM_ALM_PROJECT_YIELD")
def _(p):
    if p["variant"] == "INSURER":
        bal = p["D"]
        for _ in range(p["years"]):
            bal = bal * (1 + p["rf"]) - p["claim"]
        flows = [(0, -p["E0"]), (p["k"], p["fee"]), (p["years"], (1 - p["share"]) * bal)]
        return bisect(lambda y: pv_flows(flows, y), -0.5, 3.0) * 100, LOOSE

    def gap(i):
        bal = 0.0
        for _ in range(p["years"]):
            bal = bal * (1 + i) + p["C"]
        return bal * v(p["r"], p["years"]) - p["P"]

    return bisect(gap, 1e-9, 1.0) * 100, LOOSE


@check("FM_ALM_REINVESTMENT_THRESHOLD")
def _(p):
    left = p["A1"] * (1 + p["y1"]) - p["R"]
    second = p["A2"] * (1 + p["y2"]) * (1 + p["y2"])
    return bisect(lambda x: left * (1 + x) + second - p["R"], -0.9, 5.0) * 100, LOOSE


@check("FM_ALM_ZERO_COUPON_ROLLOVER")
def _(p):
    n1, n2 = p["n1"], p["n2"]
    short = p["a"] * (1 + p["y"]) ** n1 * (1 + p["y2"]) ** n1
    maturity = p["b"] * (1 + p["y"]) ** n2
    sale = maturity * v(p["y3"], n2 - 2 * n1)
    return short + sale - (p["a"] + p["b"]), TOL


@check("FM_ALM_CONCEPT_YIELD_CURVE")
def _(p):
    spots = [(1000 / price) ** (1 / (t + 1)) - 1 for t, price in enumerate(p["prices"])]
    first = [spots[k + 1] - spots[k] for k in range(3)]
    second = [first[k + 1] - first[k] for k in range(2)]
    if max(abs(s - spots[0]) for s in spots) < 1e-4:
        return "The yield curve is flat.", TOL
    if max(abs(x) for x in second) < 2e-4:
        return ("The yield curve is increasing with constant slope." if first[0] > 0 else "The yield curve is inverted with constant slope."), TOL
    return ("The yield curve is concave upward." if second[0] > 0 else "The yield curve is concave downward."), TOL


@check("FM_ALM_CONCEPT_YIELD_RATES")
def _(p):
    flows = list(zip(p["times"], p["amounts"]))
    # An offset grid, so a root on a round rate never sits exactly on a grid point.
    grid = [-0.95 + 0.0001234 + k * 0.0005 for k in range(int(10.95 / 0.0005))]
    roots = []
    for lo, hi in zip(grid, grid[1:]):
        if pv_flows(flows, lo) * pv_flows(flows, hi) < 0:
            roots.append(bisect(lambda y: pv_flows(flows, y), lo, hi))
    if not roots:
        return "no yield rate found", TOL  # fails the comparison loudly
    T = p["T"]
    t = pct_text(T)
    if len(roots) == 1:
        return (f"There is a unique yield rate, which is {'higher' if roots[0] > T else 'lower'} than {t}."), TOL
    if all(r > T for r in roots):
        return f"There are multiple yield rates, but all are higher than {t}.", TOL
    if all(r < T for r in roots):
        return f"There are multiple yield rates, but all are lower than {t}.", TOL
    return f"There are multiple yield rates with at least one lower than {t} and at least one higher than {t}.", TOL


# ---------------------------------------------------------------------------
# Duration and convexity — from definitions, with perpetuities as long series
# ---------------------------------------------------------------------------

def mac(flows, i):
    return sum(t * a * v(i, t) for t, a in flows) / pv_flows(flows, i)


def mod_numeric(flows, i, h=1e-6):
    """Modified duration as -P'(i)/P(i), by a central difference."""
    return -(pv_flows(flows, i + h) - pv_flows(flows, i - h)) / (2 * h) / pv_flows(flows, i)


def perpetuity(i, g=0.0, due=False, terms=6000):
    first = 0 if due else 1
    return [(first + k, (1 + g) ** k) for k in range(terms)]


def mac_series(i, g=0.0, due=False):
    ratio = (1 + g) / (1 + i)
    num = den = 0.0
    term = 1.0 if due else 1 / (1 + i)
    t = 0 if due else 1
    for _ in range(20000):
        num += t * term
        den += term
        term *= ratio
        t += 1
        if term < 1e-18:
            break
    return num / den


@check("FM_ALM_DURATION_OF_FLOWS")
def _(p):
    variant = p["variant"]
    if variant == "ZEROS":
        values = [c * price for c, price in zip(p["counts"], p["prices"])]
        return sum((t + 1) * x for t, x in enumerate(values)) / sum(values), TOL
    if variant == "FLOWS":
        flows = list(zip(p["times"], p["amounts"]))
        i = p["i"]
    elif variant == "BOND":
        if p["semi"]:
            flows = bond_list(p["F"] * p["r"] / 2, p["F"], 2 * p["years"])
            return mac(flows, p["r"] / 2) / 2, TOL
        flows = bond_list(p["F"] * p["r"], p["F"], p["years"])
        i = p["i"]
    else:
        flows = [(t, 1.0) for t in range(1, p["years"] + 1)]
        i = p["i"]
    return (mod_numeric(flows, i) if p["ask"] == "MOD" else mac(flows, i)), LOOSE


@check("FM_ALM_DURATION_CONVERSION")
def _(p):
    variant = p["variant"]
    if variant == "DERIVATIVE":
        return -p["deriv"] * (1 + p["i"]) / p["P"], TOL
    if variant == "ZERO":
        i = bisect(lambda x: p["F"] * v(x, p["T"]) - p["P"], 1e-9, 1.0)
        return mod_numeric([(p["T"], p["F"])], i), LOOSE
    if variant == "TWO_FLOWS":
        flows = [(0, p["A"]), (p["T"], p["B"])]
        i = bisect(lambda x: mac(flows, x) - p["D"], 1e-6, 2.0)
        return mod_numeric(flows, i), LOOSE
    if variant == "PERP_DUE":
        i = bisect(lambda x: mac_series(x, due=True) - p["given"], 0.001, 1.0)
        return mac_series(i, due=True) / (1 + i), LOOSE
    if variant == "PERP_IMM":
        # modified duration of a perpetuity-immediate = Macaulay / (1 + i)
        i = bisect(lambda x: mac_series(x) / (1 + x) - p["given"], 0.001, 1.0)
        return mac_series(i), LOOSE
    d1, d2, m = p["d1"], p["d2"], p["m"]
    pairings = [(d, other) for d, other in ((d1, d2), (d2, d1)) if d / m > 1]
    assert len(pairings) == 1, "ambiguous pairing"
    d, other = pairings[0]
    return other / (d / m), TOL


@check("FM_ALM_DURATION_PERPETUITY")
def _(p):
    variant = p["variant"]
    if variant in ("LEVEL", "GROWING"):
        return mac_series(p["i"], p["g"]), LOOSE
    if variant == "DEFERRED":
        i = p["i"]
        return (p["k"] - 1 + mac_series(i)) / (1 + i), LOOSE
    if variant == "RATE_CHANGE":
        i = bisect(lambda x: mac_series(x) - p["D"], 0.001, 2.0)
        return mac_series(p["factor"] * i), LOOSE
    if variant == "DUE_GEOMETRIC":
        g = p["g"]
        i = bisect(lambda x: mac_series(x, g, due=True) - p["D"], g + 0.001, 2.0)
        return p["D"] / (1 + i), LOOSE
    if variant == "PERP_VS_DUE":
        i = bisect(lambda x: mac_series(x) - p["D"], 0.001, 2.0)
        return mac_series(i, due=True) / (1 + i), LOOSE
    if variant == "ZERO_TWICE":
        i = bisect(lambda x: mac_series(x) - p["q"] * p["T"], 0.001, 2.0)
        return mac_series(i) / (1 + i), LOOSE
    i = p["T"] / p["m"] - 1
    return mac([(t, 1.0) for t in range(1, p["T"] + 1)], i), TOL


@check("FM_ALM_DURATION_ANNUITY")
def _(p):
    variant = p["variant"]
    if variant == "DUE_EXTENSION":
        n = p["count"]
        due = lambda k: [(t, 1.0) for t in range(k)]
        i = bisect(lambda x: mac(due(n), x) - p["DA"], -0.5, 5.0)
        return mac(due(n + 1), i), LOOSE
    if variant == "PHASED":
        flows = [(t, 1.0) for t in range(p["n1"])] + [(p["n1"] + t, p["k"]) for t in range(p["n2"])]
        return mac(flows, p["i"]), TOL
    if variant == "SHIFTED":
        i = p["i"]
        A = lambda X: [(p["t1"], p["a"]), (p["t2"], p["b"]), (p["t3"], X)]
        # -P'(i) - D P(i) is linear in X.
        cond = lambda X: sum(t * a * v(i, t + 1) for t, a in A(X)) - p["DA"] * pv_flows(A(X), i)
        X = linear_root(cond)
        B = [(p["t1"] + 1, p["a"]), (p["t2"] + 1, p["b"]), (p["t3"] + 2, X)]
        return mod_numeric(B, i), LOOSE
    j = p["k"] / (p["D2"] - p["D1"]) - 1
    macaulay_original = (1 + j) * p["D1"]
    return macaulay_original * p["P0"] / (p["P0"] + p["A"]), TOL


def linear_root(f):
    f0, f1 = f(0.0), f(1.0)
    return -f0 / (f1 - f0)


@check("FM_ALM_PORTFOLIO_DURATION")
def _(p):
    variant = p["variant"]
    if variant == "PORTFOLIO":
        r, F = p["r"], p["F"]
        flows = bond_list(F * r, F, p["years"]) + [(p["T1"], F), (p["T2"], F)]
        return mac(flows, r), TOL
    if variant == "WEIGHT":
        DA = mac(bond_list(p["F"] * p["r"], p["F"], p["years"]), p["i"])
        return linear_root(lambda w: w * DA + (1 - w) * 1 - p["target"]) * 100, TOL
    if variant == "BEFORE_AFTER":
        r, n, F = p["r"], p["years"], p["F"]
        flows = bond_list(F * r, F, n)
        d1 = mac([(t - 1, a) for t, a in flows], r)  # just before the first coupon, time 1-
        d2 = mac(bond_list(F * r, F, n - 1), r)
        return d1 / d2, TOL
    i = p["i"]
    DL = mac([(p["t1"], p["L1"]), (p["t2"], p["L2"])], i)
    DA = mac([(p["s1"], 1.0), (p["s2"], 1.0)], i)
    return abs(DA - DL), TOL


@check("FM_ALM_CONVEXITY")
def _(p):
    i = p["i"]
    if p["variant"] == "CONVERT":
        return (p["C"] + p["D"]) / (1 + i) ** 2, TOL
    flows = [(p["T"], p["F"])] if p["variant"] == "ZERO" else list(zip(p["times"], p["amounts"]))
    price = pv_flows(flows, i)
    if p["ask"] == "MAC":
        return sum(t * t * a * v(i, t) for t, a in flows) / price, TOL
    h = 1e-4
    second = (pv_flows(flows, i + h) - 2 * price + pv_flows(flows, i - h)) / h ** 2
    return second / price, LOOSE


@check("FM_ALM_FIRST_ORDER_APPROX")
def _(p):
    variant = p["variant"]

    def est(P, D, i0, i1, method):
        return P * (1 - D / (1 + i0) * (i1 - i0)) if method == "MOD" else P * ((1 + i0) / (1 + i1)) ** D

    if variant == "PRICE":
        return est(1000, p["D"], p["i0"], p["i1"], p["method"]), TOL
    if variant == "PCT":
        i1 = p["i0"] + p["sign"] * p["delta"]
        return (est(1, p["D"], p["i0"], i1, p["method"]) - 1) * 100, TOL
    if variant == "DIFF":
        Dmac = p["Dmod"] * (1 + p["i0"])
        return est(p["P"], Dmac, p["i0"], p["i1"], "MAC") - est(p["P"], Dmac, p["i0"], p["i1"], "MOD"), TOL
    if variant == "SOLVE_RATE":
        total = p["P1"] + p["P2"]
        D = (p["P1"] * p["D1"] + p["P2"] * p["D2"]) / total
        return bisect(lambda i: est(total, D, p["i0"], i, "MAC") - p["target"], -0.5, 1.0) * 100, LOOSE
    if variant == "SOLVE_DURATION":
        D = bisect(lambda d: est(p["P"], d, p["i0"], p["i1"], "MAC") - p["E"], 0.0, 200.0)
        return D / (1 + p["i0"]), LOOSE
    if variant == "OTHER_BOND":
        # Recover the starting rate from Bond 1, then apply it to Bond 2.
        step = p["bp"] / 10000
        sign = 1 if p["E1"] < p["PV"] else -1
        f = lambda i0: p["PV"] * ((1 + i0) / (1 + i0 + sign * step)) ** (p["D1"] * (1 + i0)) - p["E1"]
        i0 = bisect(f, 0.0001, 0.5)
        return p["PV"] * ((1 + i0) / (1 + i0 + sign * step)) ** (p["D2"] * (1 + i0)), LOOSE
    i0, i1, R = p["i0"], p["i1"], p["R"]
    flows = [(t, R) for t in range(0, 6000)]
    L = pv_flows(flows, i0)
    return L * (1 - mod_numeric(flows, i0) * (i1 - i0)) - L, LOOSE


@check("FM_ALM_APPROX_ERROR")
def _(p):
    g, i0, i1, due = p["g"], p["i0"], p["i1"], bool(p["due"])

    def price(i):
        ratio = (1 + g) / (1 + i)
        term = 1.0 if due else 1 / (1 + i)
        total = 0.0
        for _ in range(20000):
            total += term
            term *= ratio
            if term < 1e-18:
                break
        return total

    M, P = price(i0), price(i1)
    D = mac_series(i0, g, due)
    E = M * (1 - D / (1 + i0) * (i1 - i0)) if p["method"] == "MOD" else M * ((1 + i0) / (1 + i1)) ** D
    return (E - P) / P * 100, LOOSE


# ---------------------------------------------------------------------------
# Matching and immunization — small linear systems solved directly
# ---------------------------------------------------------------------------

def solve_linear(A, b):
    """Gaussian elimination with partial pivoting."""
    n = len(b)
    M = [row[:] + [b[k]] for k, row in enumerate(A)]
    for c in range(n):
        piv = max(range(c, n), key=lambda r: abs(M[r][c]))
        M[c], M[piv] = M[piv], M[c]
        for r in range(n):
            if r != c:
                f = M[r][c] / M[c][c]
                M[r] = [x - f * y for x, y in zip(M[r], M[c])]
    return [M[k][n] / M[k][k] for k in range(n)]


def match_two(liabilities, s1, s2, df):
    """Asset amounts (future values) at s1 and s2 matching PV and duration."""
    PL = sum(a * df(t) for t, a in liabilities)
    TL = sum(t * a * df(t) for t, a in liabilities)
    a, b = solve_linear([[df(s1), df(s2)], [s1 * df(s1), s2 * df(s2)]], [PL, TL])
    return a, b, PL, TL


@check("FM_ALM_EXACT_MATCH")
def _(p):
    m = p["m"]
    if p["variant"] == "MISSING":
        c = p["coupons"]
        L1, L3, L4 = p["liabilities"]
        # Cash-flow matrix at times 1, 3, 4 for bonds maturing at 1, 3, 4.
        faces = solve_linear([[1 + c[0], c[1], c[2]], [0, 1 + c[1], c[2]], [0, 0, 1 + c[2]]], [L1, L3, L4])
        return c[1] * faces[1] + c[2] * faces[2], TOL
    mats = p["maturities"]
    coupons = [x / m for x in p["coupons"]]
    yields = [x / m for x in p["yields"]]
    n = len(mats)
    A = [[(coupons[k] if mats[k] >= t else 0) + (1 if mats[k] == t else 0) for k in range(n)] for t in range(1, n + 1)]
    faces = solve_linear(A, p["liabilities"])
    prices = [faces[k] * pv_flows(bond_list(coupons[k], 1.0, mats[k]), yields[k]) for k in range(n)]
    variant = p["variant"]
    if variant == "UNITS":
        return faces[0] / 100, TOL
    if variant == "FACE":
        return faces[p["target"]], TOL
    if variant == "DIFF":
        return prices[0] - prices[-1], TOL
    return sum(prices), TOL


@check("FM_ALM_EXACT_MATCH_PARTIAL")
def _(p):
    variant = p["variant"]
    if variant == "MORTGAGES":
        R2 = p["L2"]  # Mortgage II's level payment covers the whole time-2 liability
        Y = R2 / (1 + p["i2"]) + R2 / (1 + p["i2"]) ** 2
        X = (p["L1"] - R2) / (1 + p["i1"])
        return X + Y, TOL
    if variant == "GIVEN_TOTAL":
        F, c = p["F"], p["c"]
        P2 = pv_flows(bond_list(F * c, F, 2), p["y2"])
        A, B = solve_linear([[1, F * c], [1 / (1 + p["y1"]), P2]], [p["L1"], p["total"]])
        return A / (1 + p["y1"]), TOL
    if variant == "GIVEN_LONG":
        unit = pv_flows(bond_list(p["c"], 1.0, 2), p["y2"])
        Y = p["I2"] / unit
        L1 = Y * (1 + p["c"]) / p["k"]
        return (L1 - p["c"] * Y) / (1 + p["y1"]), TOL
    return p["L1"] / (1 + p["y1"]) + p["L3"] / (1 + p["f"]) / (1 + p["y2"]) ** 2, TOL


@check("FM_ALM_FULL_IMMUNIZATION")
def _(p):
    variant = p["variant"]
    if variant == "ASK":
        i = p["i"]
        A, B, _, _ = match_two([(p["T"], p["L"])], p["t1"], p["t2"], lambda t: v(i, t))
        return {"A": A, "B": B, "DIFF": abs(A - B)}[p["ask"]], TOL
    if variant == "UNKNOWN_TIME":
        i, T, t1 = p["i"], p["T"], p["t1"]
        PL = p["L"] * v(i, T)
        a = p["A"] * v(i, t1)

        def dur_gap(n):
            b = PL - a
            return t1 * a + n * b - T * PL

        n = bisect(dur_gap, T, 200.0)
        B = (PL - a) * (1 + i) ** n
        return {"TIME": n, "AMOUNT": B, "RATIO": B / (n - T)}[p["ask"]], LOOSE
    if variant == "LIABILITY":
        T, t1, t2, x, y = p["T"], p["t1"], p["t2"], p["x"], p["y"]
        i = bisect(lambda r: (T - t1) * x * v(r, t1) - (t2 - T) * y * v(r, t2), -0.5, 1.0)
        return (x * v(i, t1) + y * v(i, t2)) * (1 + i) ** T, LOOSE
    vf = p["v"]
    df = lambda t: vf ** t
    X, Z, _, _ = match_two([(p["T"], p["L"] - p["Y"])], p["t1"], p["t2"], df)
    return X, TOL


@check("FM_ALM_FULL_IMMUNIZATION_SURPLUS")
def _(p):
    i0, i1 = p["i0"], p["i1"]
    B = (p["L"] * v(i0, p["T"]) - p["A"] * v(i0, p["t1"])) * (1 + i0) ** p["t2"]
    assets = pv_flows([(p["t1"], p["A"]), (p["t2"], B)], i1)
    return assets - p["L"] * v(i1, p["T"]), TOL


@check("FM_ALM_REDINGTON_TWO_ASSETS")
def _(p):
    import math
    variant = p["variant"]
    if variant == "ANNUITY":
        i = p["i"]
        A, B, _, _ = match_two([(t, p["R"]) for t in range(1, p["years"] + 1)], p["s1"], p["s2"], lambda t: v(i, t))
        return A * v(i, p["s1"]), TOL
    if variant == "SINGLE_PV":
        i = (p["L"] / p["PV"]) ** (1 / p["T"]) - 1
        A, B, _, _ = match_two([(p["T"], p["L"])], p["s1"], p["s2"], lambda t: v(i, t))
        return A * v(i, p["s1"]), LOOSE
    if variant == "SINGLE_RATIO":
        i = p["i"]
        A, B, _, _ = match_two([(p["T"], p["L"])], p["s1"], p["s2"], lambda t: v(i, t))
        return A / B, TOL
    if variant == "HALF_YEAR":
        i = p["i"]
        A, B, _, _ = match_two([(0.75, p["L"])], 0.5, 1.0, lambda t: v(i, t))
        return A, TOL
    if variant == "TWO_LIABS":
        i = p["i"]
        A, B, _, _ = match_two([(p["t1"], p["L1"]), (p["t2"], p["L2"])], p["s1"], p["s2"], lambda t: v(i, t))
        return {"RATIO": B / A, "Y": B, "X": A}[p["ask"]], TOL
    if variant == "FORCE":
        d = p["delta"]
        df = lambda t: math.exp(-d * t)
        A, B, _, _ = match_two([(p["t1"], p["L"]), (p["t2"], p["L"])], p["s1"], p["s2"], df)
        return (A * df(p["s1"]) if p["askFirst"] else B * df(p["s2"])), TOL
    i = p["i"]
    A, B, PL, _ = match_two([(t, p["R"]) for t in (1, 2, 3)], 1, 3, lambda t: v(i, t))
    share = A * v(i, 1) / PL
    return p["total"] * share, TOL


@check("FM_ALM_REDINGTON_DURATIONS")
def _(p):
    variant = p["variant"]
    if variant == "MOD_DURATION":
        i, T = p["i"], p["T"]
        total = p["A1"] + p["A2"]
        liability_mod = mod_numeric([(T, p["L"])], i)
        return linear_root(lambda d: (p["A1"] * p["D1"] + p["A2"] * d) / total - liability_mod), LOOSE
    if variant == "THREE_BONDS":
        PL = p["L"] * v(p["i"], p["T"])
        k = p["k"]
        x, y = solve_linear([[1, 1 + k], [p["DA"], p["DB"] + k * p["DC"]]], [PL, p["T"] * PL])
        return x, TOL
    return (p["A1"] * p["T1"] + p["A2"] * p["T2"]) / (p["A1"] + p["A2"]), TOL


ROMAN_SCHEMES = {
    "ONE": (["I only", "II only", "III only", "I, II, and III"],
            [[True, False, False], [False, True, False], [False, False, True], [True, True, True]]),
    "PAIRS": (["None", "I and II only", "I and III only", "II and III only"],
              [[False, False, False], [True, True, False], [True, False, True], [False, True, True]]),
}


def roman_key(scheme, truth):
    labels, patterns = ROMAN_SCHEMES[scheme]
    for label, pattern in zip(labels, patterns):
        if pattern == truth:
            return label
    return "The correct answer is not given by (A), (B), (C), or (D)."


@check("FM_ALM_IMMUNIZATION_CHECK")
def _(p):
    if p["variant"] == "SETS":
        i, T, L = p["i"], p["T"], p["L"]
        PL = L * v(i, T)
        truth = []
        for t1, t2, a1, a2 in zip(p["times1"], p["times2"], p["amounts1"], p["amounts2"]):
            flows = [(t1, a1), (t2, a2)]
            ok = abs(pv_flows(flows, i) - PL) < 0.5 and abs(mac(flows, i) - T) < 0.001 and t1 < T < t2
            truth.append(ok)
        return roman_key(p["scheme"], truth), TOL
    truth = [pa == pl and da == dl and ca > cl for pa, da, ca, pl, dl, cl in zip(p["PVA"], p["DA"], p["CA"], p["PVL"], p["DL"], p["CL"])]
    return roman_key(p["scheme"], truth), TOL


@check("FM_ALM_CONCEPT_TERM")
def _(p):
    if "redington" in p:
        return ("Only a small change in the yield rate" if p["redington"] else "Any change in the yield rate"), TOL
    return ["Diversified", "Fully immunized", "Fully leveraged", "Exactly matched", "Redington immunized"][p["key"]], TOL
