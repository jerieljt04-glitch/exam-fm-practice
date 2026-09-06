/**
 * SOA Exam FM - Financial Mathematics Engine
 * Rigorous implementation of actuarial formulas for time value of money,
 * annuities, loans, bonds, and asset-liability management.
 */

export const ActuarialMath = {
  // Discount factor v = 1 / (1 + i)
  v(i: number): number {
    return 1 / (1 + i);
  },

  // Nominal to effective interest rate: i = (1 + i^(m)/m)^m - 1
  nominalToEffectiveRate(nominal: number, m: number): number {
    return Math.pow(1 + nominal / m, m) - 1;
  },

  // Effective to nominal interest rate: i^(m) = m * ((1 + i)^(1/m) - 1)
  effectiveToNominalRate(i: number, m: number): number {
    return m * (Math.pow(1 + i, 1 / m) - 1);
  },

  // Nominal discount rate to effective rate: d^(m) -> i
  nominalDiscountToEffectiveRate(dm: number, m: number): number {
    const v = Math.pow(1 - dm / m, m);
    return 1 / v - 1;
  },

  // Force of interest delta = ln(1 + i)
  delta(i: number): number {
    return Math.log(1 + i);
  },

  // Discount rate d = i / (1 + i)
  discountRate(i: number): number {
    return i / (1 + i);
  },

  // Accumulation under constant force of interest: e^(delta * t)
  accumulateDelta(delta: number, t: number): number {
    return Math.exp(delta * t);
  },

  // Accumulation under linear force of interest delta(t) = a + b*t
  accumulateLinearDelta(a: number, b: number, t1: number, t2: number): number {
    const integral = a * (t2 - t1) + 0.5 * b * (t2 * t2 - t1 * t1);
    return Math.exp(integral);
  },

  // Present value of Level Annuity Immediate: a_angle_n = (1 - v^n) / i
  annuityImmediate(n: number, i: number): number {
    if (i === 0) return n;
    const v = this.v(i);
    return (1 - Math.pow(v, n)) / i;
  },

  // Present value of Level Annuity Due: a_due_angle_n = (1+i) * a_angle_n = (1 - v^n) / d
  annuityDue(n: number, i: number): number {
    return (1 + i) * this.annuityImmediate(n, i);
  },

  // Accumulated value of Level Annuity Immediate: s_angle_n = ((1+i)^n - 1) / i
  accumulatedAnnuityImmediate(n: number, i: number): number {
    if (i === 0) return n;
    return (Math.pow(1 + i, n) - 1) / i;
  },

  // Accumulated value of Level Annuity Due: s_due_angle_n = (1+i) * s_angle_n
  accumulatedAnnuityDue(n: number, i: number): number {
    return (1 + i) * this.accumulatedAnnuityImmediate(n, i);
  },

  // Continuous annuity present value: a_bar_angle_n = (1 - v^n) / delta
  continuousAnnuity(n: number, i: number): number {
    const d = this.delta(i);
    const v = this.v(i);
    return (1 - Math.pow(v, n)) / d;
  },

  // Perpetuity Immediate: 1 / i
  perpetuityImmediate(i: number): number {
    return 1 / i;
  },

  // Perpetuity Due: 1 / d = (1 + i) / i
  perpetuityDue(i: number): number {
    return (1 + i) / i;
  },

  // Increasing Annuity Immediate: (Ia)_angle_n = (a_due_angle_n - n * v^n) / i
  increasingAnnuityImmediate(n: number, i: number): number {
    const aDue = this.annuityDue(n, i);
    const v = this.v(i);
    return (aDue - n * Math.pow(v, n)) / i;
  },

  // Decreasing Annuity Immediate: (Da)_angle_n = (n - a_angle_n) / i
  decreasingAnnuityImmediate(n: number, i: number): number {
    const aImm = this.annuityImmediate(n, i);
    return (n - aImm) / i;
  },

  // Geometric Annuity Present Value: payments P, P(1+g), P(1+g)^2, ...
  geometricAnnuity(p: number, g: number, i: number, n: number): number {
    if (Math.abs(i - g) < 1e-7) {
      return p * n * this.v(i);
    }
    const ratio = (1 + g) / (1 + i);
    return (p / (i - g)) * (1 - Math.pow(ratio, n));
  },

  // Loan level payment: R = L / a_angle_n
  loanPayment(loanAmount: number, n: number, i: number): number {
    const a = this.annuityImmediate(n, i);
    return loanAmount / a;
  },

  // Loan prospective balance: B_t = R * a_angle_(n-t)
  loanProspectiveBalance(payment: number, remainingPeriods: number, i: number): number {
    return payment * this.annuityImmediate(remainingPeriods, i);
  },

  // Loan interest paid in period t: I_t = i * B_(t-1)
  loanInterestPaidAt(payment: number, totalPeriods: number, period: number, i: number): number {
    const v = this.v(i);
    return payment * (1 - Math.pow(v, totalPeriods - period + 1));
  },

  // Loan principal paid in period t: P_t = R * v^(n - t + 1)
  loanPrincipalPaidAt(payment: number, totalPeriods: number, period: number, i: number): number {
    const v = this.v(i);
    return payment * Math.pow(v, totalPeriods - period + 1);
  },

  // Sinking Fund total annual outlay: i * L + L / s_angle_n(j)
  sinkingFundAnnualCost(loanAmount: number, n: number, iLoan: number, jSink: number): number {
    const interestPortion = loanAmount * iLoan;
    const sinkingPortion = loanAmount / this.accumulatedAnnuityImmediate(n, jSink);
    return interestPortion + sinkingPortion;
  },

  // Bond Price (Basic Formula): P = F * r * a_angle_n(i) + C * v^n
  bondPrice(par: number, couponRate: number, yieldRate: number, redemptionValue: number, n: number): number {
    const coupon = par * couponRate;
    const a = this.annuityImmediate(n, yieldRate);
    const v = this.v(yieldRate);
    return coupon * a + redemptionValue * Math.pow(v, n);
  },

  // Bond Book Value at time t
  bondBookValue(par: number, couponRate: number, yieldRate: number, redemptionValue: number, n: number, t: number): number {
    return this.bondPrice(par, couponRate, yieldRate, redemptionValue, n - t);
  },

  /**
   * Yield rate per coupon period implied by a bond price, solved by bisection.
   * `price` and `redemptionValue` are per the same par as `couponRate`.
   * Returns the periodic yield, or NaN when no root exists in (0, 1].
   */
  bondYieldToMaturity(
    par: number,
    couponRate: number,
    redemptionValue: number,
    n: number,
    price: number,
    tolerance: number = 1e-12
  ): number {
    let low = 1e-9;
    let high = 1;

    const priceAt = (y: number) => this.bondPrice(par, couponRate, y, redemptionValue, n);

    // The bond price is strictly decreasing in the yield, so a sign change
    // between the bracket endpoints guarantees a unique root.
    if ((priceAt(low) - price) * (priceAt(high) - price) > 0) return NaN;

    for (let iteration = 0; iteration < 200; iteration += 1) {
      const mid = (low + high) / 2;
      const diff = priceAt(mid) - price;
      if (Math.abs(diff) < tolerance || high - low < tolerance) return mid;
      if (diff > 0) {
        low = mid;
      } else {
        high = mid;
      }
    }

    return (low + high) / 2;
  },

  // ----- Yield curves, forward rates and swaps -----------------------------

  /** Discount factor implied by an annual effective spot rate: P(0,t). */
  spotDiscountFactor(spot: number, t: number): number {
    return Math.pow(1 + spot, -t);
  },

  /**
   * Discount factors P(0,1..n) for a spot curve given as annual effective
   * rates, `spots[k]` being the k+1 year spot rate.
   */
  spotDiscountFactors(spots: number[]): number[] {
    return spots.map((spot, index) => this.spotDiscountFactor(spot, index + 1));
  },

  /** Present value of dated cash flows discounted along a spot curve. */
  presentValueAtSpots(cashFlows: { t: number; amount: number }[], spots: number[]): number {
    return cashFlows.reduce(
      (total, cf) => total + cf.amount * this.spotDiscountFactor(spots[cf.t - 1], cf.t),
      0
    );
  },

  /**
   * Annualised forward rate covering (t1, t2], implied by the spot curve:
   * (1 + f)^(t2 - t1) = (1 + s_{t2})^{t2} / (1 + s_{t1})^{t1}.
   */
  forwardRate(spots: number[], t1: number, t2: number): number {
    const growthTo2 = Math.pow(1 + spots[t2 - 1], t2);
    const growthTo1 = t1 === 0 ? 1 : Math.pow(1 + spots[t1 - 1], t1);
    return Math.pow(growthTo2 / growthTo1, 1 / (t2 - t1)) - 1;
  },

  /**
   * Par swap rate for settlements at times `start+1 .. end`, from discount
   * factors indexed from time 1. A deferred swap uses start > 0:
   * R = [P(0,start) - P(0,end)] / sum of P(0,t) over the settlement dates.
   */
  swapRate(discountFactors: number[], start: number = 0, end?: number): number {
    const last = end ?? discountFactors.length;
    const startFactor = start === 0 ? 1 : discountFactors[start - 1];
    let annuity = 0;
    for (let t = start + 1; t <= last; t += 1) annuity += discountFactors[t - 1];
    return annuity === 0 ? 0 : (startFactor - discountFactors[last - 1]) / annuity;
  },

  /**
   * Level annual effective yield equating dated cash flows to a price, by
   * bisection. Returns NaN when no root exists in (0, 1].
   */
  levelYield(
    cashFlows: { t: number; amount: number }[],
    price: number,
    tolerance: number = 1e-12
  ): number {
    const valueAt = (rate: number) =>
      cashFlows.reduce((total, cf) => total + cf.amount * Math.pow(1 + rate, -cf.t), 0);

    let low = 1e-9;
    let high = 1;
    if ((valueAt(low) - price) * (valueAt(high) - price) > 0) return NaN;

    for (let iteration = 0; iteration < 200; iteration += 1) {
      const mid = (low + high) / 2;
      const diff = valueAt(mid) - price;
      if (Math.abs(diff) < tolerance || high - low < tolerance) return mid;
      if (diff > 0) low = mid;
      else high = mid;
    }
    return (low + high) / 2;
  },

  /**
   * Present value of a continuously payable annuity whose payment rate grows
   * linearly, rho(t) = t, over n years at constant force delta:
   * integral of t e^{-delta t} dt = [1 - e^{-delta n}(1 + delta n)] / delta^2.
   */
  continuousIncreasingAnnuity(n: number, delta: number): number {
    const discount = Math.exp(-delta * n);
    return (1 - discount * (1 + delta * n)) / (delta * delta);
  },

  // Macaulay Duration of general cash flows: D_mac = sum(t * Ct * v^t) / sum(Ct * v^t)
  macaulayDuration(cashFlows: { t: number; amount: number }[], y: number): number {
    let numerator = 0;
    let denominator = 0;
    for (const cf of cashFlows) {
      const pv = cf.amount * Math.pow(1 + y, -cf.t);
      numerator += cf.t * pv;
      denominator += pv;
    }
    return denominator === 0 ? 0 : numerator / denominator;
  },

  // Macaulay Duration for standard bond
  bondMacaulayDuration(par: number, couponRate: number, yieldRate: number, redemptionValue: number, n: number): number {
    const coupon = par * couponRate;
    const cashFlows: { t: number; amount: number }[] = [];
    for (let t = 1; t <= n; t++) {
      cashFlows.push({
        t,
        amount: t === n ? coupon + redemptionValue : coupon,
      });
    }
    return this.macaulayDuration(cashFlows, yieldRate);
  },

  // Modified Duration: D_mod = v * D_mac = D_mac / (1 + y)
  modifiedDuration(macaulayDuration: number, y: number): number {
    return macaulayDuration / (1 + y);
  },

  // Macaulay Convexity of cash flows: C_mac = sum(t^2 * Ct * v^t) / sum(Ct * v^t)
  macaulayConvexity(cashFlows: { t: number; amount: number }[], y: number): number {
    let numerator = 0;
    let denominator = 0;
    for (const cf of cashFlows) {
      const pv = cf.amount * Math.pow(1 + y, -cf.t);
      numerator += cf.t * cf.t * pv;
      denominator += pv;
    }
    return denominator === 0 ? 0 : numerator / denominator;
  },

  // Modified Convexity: C_mod = (C_mac + D_mac) / (1 + y)^2 = (1 / P) * d^2P / dy^2
  modifiedConvexity(cashFlows: { t: number; amount: number }[], y: number): number {
    let numerator = 0;
    let price = 0;
    for (const cf of cashFlows) {
      const pv = cf.amount * Math.pow(1 + y, -cf.t);
      numerator += cf.t * (cf.t + 1) * pv;
      price += pv;
    }
    return price === 0 ? 0 : numerator / (price * Math.pow(1 + y, 2));
  },
};
