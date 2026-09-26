"""
Shared first-principles tools for the independent audit.

Nothing here mirrors the TypeScript engine. Where a generator uses a
closed-form actuarial factor, the checks deliberately recompute by explicit
cash-flow sums, period-by-period ledgers, numerical integration or bisection,
so a wrong formula in the engine cannot be reproduced by the checker.
"""
import math

TOL = 1e-6      # closed-form agreement
LOOSE = 2e-4    # numerical integration / root finding

CHECKS = {}


def check(name):
    """Registers a re-derivation for template `name`. It receives the
    question's `variables` and returns (expected, relative tolerance)."""
    def deco(fn):
        CHECKS[name] = fn
        return fn
    return deco


def v(i, t):
    return (1.0 + i) ** (-t)


def integrate(f, a, b, n=4000):
    """Simpson's rule."""
    if n % 2:
        n += 1
    if b == a:
        return 0.0
    h = (b - a) / n
    s = f(a) + f(b)
    for k in range(1, n):
        s += (4 if k % 2 else 2) * f(a + k * h)
    return s * h / 3


def bisect(f, lo, hi, iters=200):
    flo = f(lo)
    fhi = f(hi)
    if flo * fhi > 0:
        raise ValueError(f"no sign change on [{lo}, {hi}]")
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


def solve_yield(flows, lo=-0.5, hi=1.0):
    """Rate at which the flows (outlays negative) have zero present value."""
    return bisect(lambda y: pv_flows(flows, y), lo, hi)


def macaulay(flows, y):
    p = pv_flows(flows, y)
    return sum(t * a * v(y, t) for t, a in flows) / p


def grow(balance, rate, periods):
    """Accumulates period by period rather than by a power."""
    for _ in range(int(round(periods))):
        balance *= 1 + rate
    return balance


def annuity_pv(payment, count, rate, first=1, gap=1):
    """Explicit sum of level payments."""
    return sum(payment * v(rate, first + k * gap) for k in range(count))


def level_payment(loan, n, i):
    """Payment that amortizes `loan` in n periods, found by search on the ledger."""
    def leftover(R):
        bal = loan
        for _ in range(n):
            bal = bal * (1 + i) - R
        return bal
    return bisect(leftover, loan / n * 0.5, loan * (1 + i) ** n)


def amortize(loan, payments, rate_for):
    """Ledger rows (interest, principal, closing balance) for a payment list.
    `rate_for(k)` is the rate for period k (1-based)."""
    rows, bal = [], loan
    for k, R in enumerate(payments, start=1):
        interest = bal * rate_for(k)
        principal = R - interest
        bal -= principal
        rows.append((interest, principal, bal))
    return rows


def bond_flows(coupon, redemption, n):
    return [(t, coupon + (redemption if t == n else 0)) for t in range(1, n + 1)]
