// Optimize My Savings Calculation Engine
// All financial formulas and simulation logic

// =============================================
// FINANCIAL FORMULAS
// =============================================

/** Future Value of Present Sum: FV = PV × (1 + r/12)^n */
const FV = (pv, annualRate, months) => {
  if (months <= 0 || pv === 0) return pv;
  return pv * Math.pow(1 + annualRate / 12, months);
};

/** Payment to reach Future Value: PMT = FV × (r/12) / [(1 + r/12)^n - 1] */
const PMTforFV = (fv, annualRate, months) => {
  if (months <= 0 || fv <= 0) return 0;
  if (annualRate === 0) return fv / months;
  const r = annualRate / 12;
  return fv * r / (Math.pow(1 + r, months) - 1);
};

/** Present Value of Annuity: PV = PMT × [1 - (1+r/12)^-n] / (r/12) */
const PVAnnuity = (pmt, annualRate, months) => {
  if (months <= 0 || pmt === 0) return 0;
  if (annualRate === 0) return pmt * months;
  const r = annualRate / 12;
  return pmt * (1 - Math.pow(1 + r, -months)) / r;
};

/** Loan Payment (amortization) */
const LoanPMT = (principal, annualRate, months) => {
  if (months <= 0 || principal <= 0) return 0;
  if (annualRate === 0) return principal / months;
  const r = annualRate / 12;
  return principal * r / (1 - Math.pow(1 + r, -months));
};

/** Future Value of Annuity */
const FVAnnuity = (pmt, annualRate, months) => {
  if (months <= 0 || pmt === 0) return 0;
  if (annualRate === 0) return pmt * months;
  const r = annualRate / 12;
  return pmt * (Math.pow(1 + r, months) - 1) / r;
};

// =============================================
// CONSTANTS
// =============================================
const TAX_RATE = 0.28;
const RETIRE_DRAWDOWN_RATE = 0.04;
const COLLEGE_INFLATION = 0.05;

// Rate of return by time horizon
const getROR = (years) => years > 10 ? 0.07 : years > 5 ? 0.05 : 0.03;

// College target calculator
function calculateCollegeTarget(costPerYearToday, collegeYears, yearsUntilCollege) {
  const monthsUntil = yearsUntilCollege * 12;
  const futureCostPerYear = FV(costPerYearToday, COLLEGE_INFLATION, monthsUntil);
  const pvNeeded = PVAnnuity(futureCostPerYear / 12, RETIRE_DRAWDOWN_RATE, collegeYears * 12);
  return { futureCostPerYear, pvNeeded };
}

// =============================================
// MAIN CALCULATION FUNCTION
// =============================================
function calculate(input) {
  const {
    income, monthlyBudget,
    emergencyBal, emergencyMonths,
    ccBal, ccApr, ccPayoffYears,
    slBal, slApr, slPayoffYears,
    autoBal, autoApr, autoPayoffYears,
    currentAge, retireAge, retireIncomePct, lifeExpectancy,
    retirementBal, has401k, matchPercent, matchUpTo,
    hasKids, numKids, kidAges,
    collegeCostYear, collegeYears, collegeBal,
    brokerageBal
  } = input;

  const grossMonthly = income / 12;
  const afterTaxMonthly = grossMonthly * (1 - TAX_RATE);

  // Emergency Fund
  const emergencyTarget = afterTaxMonthly * emergencyMonths;
  const emergencyGap = Math.max(0, emergencyTarget - emergencyBal);

  // Debts (sorted by APR, highest first — avalanche method)
  const debts = [];
  if (ccBal > 0) {
    const pmt = LoanPMT(ccBal, ccApr / 100, ccPayoffYears * 12);
    debts.push({
      name: 'Credit Card', balance: ccBal, apr: ccApr / 100, years: ccPayoffYears,
      months: ccPayoffYears * 12, monthlyPmt: pmt, color: '#c62828'
    });
  }
  if (autoBal > 0) {
    const pmt = LoanPMT(autoBal, autoApr / 100, autoPayoffYears * 12);
    debts.push({
      name: 'Auto Loan', balance: autoBal, apr: autoApr / 100, years: autoPayoffYears,
      months: autoPayoffYears * 12, monthlyPmt: pmt, color: '#e65100'
    });
  }
  if (slBal > 0) {
    const pmt = LoanPMT(slBal, slApr / 100, slPayoffYears * 12);
    debts.push({
      name: 'Student Loan', balance: slBal, apr: slApr / 100, years: slPayoffYears,
      months: slPayoffYears * 12, monthlyPmt: pmt, color: '#5e35b1'
    });
  }
  debts.sort((a, b) => b.apr - a.apr);
  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
  const totalDebtPmt = debts.reduce((s, d) => s + d.monthlyPmt, 0);

  // Retirement (no Social Security in this tool - simpler calculation)
  const yearsToRetire = Math.max(1, retireAge - currentAge);
  const monthsToRetire = yearsToRetire * 12;
  const monthsInRetirement = Math.max(1, lifeExpectancy - retireAge) * 12;
  const accumulationROR = getROR(yearsToRetire);
  const retireIncomeMonthly = income * (retireIncomePct / 100) / 12;
  const retireTarget = PVAnnuity(retireIncomeMonthly, RETIRE_DRAWDOWN_RATE, monthsInRetirement);
  const retireFVofCurrent = FV(retirementBal, accumulationROR, monthsToRetire);
  const retireGap = Math.max(0, retireTarget - retireFVofCurrent);
  const retireMonthlyNeeded = PMTforFV(retireGap, accumulationROR, monthsToRetire);
  const monthlyMatchableContrib = has401k ? (income * (matchUpTo / 100)) / 12 : 0;
  const monthlyMatchReceived = has401k ? monthlyMatchableContrib * (matchPercent / 100) : 0;

  // College
  const collegeGoals = [];
  let totalCollegeMonthly = 0;
  if (hasKids && numKids > 0) {
    for (let i = 0; i < numKids; i++) {
      const age = kidAges[i] || 0;
      const yearsUntil = Math.max(1, 18 - age);
      const monthsUntil = yearsUntil * 12;
      const ror = getROR(yearsUntil);
      const calc = calculateCollegeTarget(collegeCostYear, collegeYears, yearsUntil);
      const perChildSaved = collegeBal / numKids;
      const fvSaved = FV(perChildSaved, ror, monthsUntil);
      const gap = Math.max(0, calc.pvNeeded - fvSaved);
      const monthly = PMTforFV(gap, ror, monthsUntil);
      totalCollegeMonthly += monthly;
      collegeGoals.push({
        childNum: i + 1, age, yearsUntil, monthsUntil, ror,
        target: calc.pvNeeded, gap, monthly, balance: perChildSaved
      });
    }
  }

  const naiveTotalMonthly = Math.max(100,
    (emergencyGap > 0 ? Math.max(100, emergencyGap / 6) : 0) +
    totalDebtPmt + monthlyMatchableContrib + totalCollegeMonthly +
    Math.max(0, retireMonthlyNeeded - monthlyMatchableContrib - monthlyMatchReceived)
  );

  // =============================================
  // SIMULATION
  // =============================================
  const simulate = (budget) => {
    let emergency = emergencyBal;
    let debtStates = debts.map(d => ({ ...d, balance: d.balance }));
    let retirement = retirementBal;
    let collegeAccts = hasKids && collegeGoals.length > 0
      ? collegeGoals.map(c => ({ ...c, balance: c.balance || collegeBal / numKids })) : [];
    let brokerage = brokerageBal;
    const timeline = [];
    const maxMonths = Math.max(monthsToRetire, ...debts.map(d => d.months),
      ...(hasKids ? collegeGoals.map(c => c.monthsUntil) : []), 480);
    let firstAlloc = null;

    for (let month = 0; month <= maxMonths; month++) {
      let available = budget;
      const alloc = { emergency: 0, debts: {}, match401k: 0, matchBonus: 0, college: 0, retirement: 0, brokerage: 0 };

      // Growth
      if (month > 0) {
        for (let d of debtStates) { if (d.balance > 0) d.balance *= (1 + d.apr / 12); }
        if (month <= monthsToRetire) retirement *= (1 + accumulationROR / 12);
        for (let c of collegeAccts) { if (month < c.monthsUntil) c.balance *= (1 + c.ror / 12); }
        brokerage *= (1 + 0.07 / 12);
      }

      // Priority allocation
      // 1. Emergency Fund
      if (emergency < emergencyTarget && available > 0) {
        const a = Math.min(available, emergencyTarget - emergency, Math.max(100, (emergencyTarget - emergency) / 6));
        emergency += a; available -= a; alloc.emergency = a;
      }
      // 2. Minimum Debt Payments
      for (let d of debtStates) {
        if (d.balance > 0 && available > 0) {
          const p = Math.min(available, d.monthlyPmt, d.balance);
          d.balance = Math.max(0, d.balance - p); available -= p;
          alloc.debts[d.name] = (alloc.debts[d.name] || 0) + p;
        }
      }
      // 3. 401k Match
      if (has401k && available > 0 && month < monthsToRetire) {
        const c = Math.min(available, monthlyMatchableContrib);
        const m = c * (matchPercent / 100);
        retirement += c + m; available -= c;
        alloc.match401k = c; alloc.matchBonus = m;
      }
      // 4. Extra debt payoff (avalanche - highest APR remaining debt)
      for (let d of debtStates) {
        if (d.balance > 0 && available > 0) {
          const x = Math.min(available, d.balance);
          d.balance = Math.max(0, d.balance - x); available -= x;
          alloc.debts[d.name] = (alloc.debts[d.name] || 0) + x;
        }
      }
      // 5. College Savings
      if (hasKids && collegeAccts.length > 0) {
        const active = collegeAccts.filter(c => month < c.monthsUntil);
        if (active.length > 0 && available > 0) {
          const pk = available / active.length;
          for (let c of active) {
            const a = Math.min(pk, c.monthly * 1.5);
            c.balance += a; available -= a; alloc.college += a;
          }
        }
      }
      // 6. Additional Retirement
      if (available > 0 && month < monthsToRetire) {
        retirement += available; alloc.retirement = available; available = 0;
      }
      // 7. Brokerage overflow
      if (available > 0) {
        brokerage += available; alloc.brokerage = available;
      }

      if (!firstAlloc) firstAlloc = { ...alloc };

      // Yearly snapshot
      if (month % 12 === 0) {
        const td = debtStates.reduce((s, d) => s + d.balance, 0);
        const tc = collegeAccts.reduce((s, c) => s + c.balance, 0);
        timeline.push({
          year: new Date().getFullYear() + Math.floor(month / 12),
          age: currentAge + Math.floor(month / 12),
          emergency: Math.round(emergency),
          totalDebt: Math.round(td),
          retirement: Math.round(retirement),
          college: Math.round(tc),
          brokerage: Math.round(brokerage),
          netWorth: Math.round(emergency + retirement + tc + brokerage - td)
        });
      }

      // Goal check
      const eMet = emergency >= emergencyTarget * 0.95;
      const dMet = debtStates.every(d => d.balance < 1);
      const rMet = month >= monthsToRetire && retirement >= retireTarget * 0.95;
      let cMet = true;
      if (hasKids) {
        for (let c of collegeAccts) {
          if (month >= c.monthsUntil && c.balance < c.target * 0.90) { cMet = false; break; }
        }
      }
      if (eMet && dMet && rMet && cMet && month >= monthsToRetire) {
        return { success: true, timeline, firstAlloc, retirementShortfall: 0, collegeShortfall: 0 };
      }
    }

    // Calculate shortfalls
    let cShort = 0;
    if (hasKids) {
      for (let c of collegeAccts) {
        if (c.balance < c.target * 0.90) cShort += c.target - c.balance;
      }
    }
    const eMet = emergency >= emergencyTarget * 0.95;
    const dMet = debtStates.every(d => d.balance < 1);
    const rMet = retirement >= retireTarget * 0.95;

    return {
      success: eMet && dMet && rMet && cShort === 0,
      timeline,
      firstAlloc,
      emergencyMet: eMet,
      debtsMet: dMet,
      retireMet: rMet,
      collegeMet: cShort === 0,
      retirementShortfall: Math.max(0, retireTarget - retirement),
      collegeShortfall: cShort
    };
  };

  const simResult = simulate(monthlyBudget);

  // Find optimal budget via binary search
  let lo2 = Math.max(100, naiveTotalMonthly * 0.3);
  let hi2 = Math.max(afterTaxMonthly * 0.95, naiveTotalMonthly * 2);
  let optBudget = hi2;
  for (let i = 0; i < 40; i++) {
    const mid = (lo2 + hi2) / 2;
    if (simulate(mid).success) { optBudget = mid; hi2 = mid - 1; }
    else lo2 = mid + 1;
    if (hi2 - lo2 < 5) break;
  }

  return {
    afterTaxMonthly,
    optimalBudget: Math.round(optBudget),
    budgetDiff: monthlyBudget - optBudget,
    savingsRate: (monthlyBudget / afterTaxMonthly) * 100,
    timeline: simResult.timeline,
    firstAlloc: simResult.firstAlloc,
    allGoalsMet: simResult.success,
    emergencyMet: simResult.emergencyMet !== undefined ? simResult.emergencyMet : simResult.success,
    retireMet: simResult.retireMet !== undefined ? simResult.retireMet : simResult.success,
    collegeMet: simResult.collegeMet !== undefined ? simResult.collegeMet : simResult.success,
    retirementShortfall: simResult.retirementShortfall || 0,
    collegeShortfall: simResult.collegeShortfall || 0,
    emergencyTarget,
    emergencyGap,
    debts,
    totalDebt,
    totalDebtPmt,
    retireTarget,
    retireGap,
    yearsToRetire,
    retireMonthlyNeeded,
    monthlyMatchableContrib,
    monthlyMatchReceived,
    collegeGoals,
    totalCollegeMonthly,
    netWorth: (emergencyBal + retirementBal + collegeBal + brokerageBal) - totalDebt,
  };
}

// =============================================
// NETLIFY FUNCTION HANDLER
// =============================================
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const input = JSON.parse(event.body);

    // Input validation
    if (typeof input.income !== 'number' || input.income < 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid income' }) };
    }
    if (typeof input.monthlyBudget !== 'number' || input.monthlyBudget < 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid monthlyBudget' }) };
    }

    // Apply defaults for optional fields
    const defaults = {
      emergencyBal: 0,
      emergencyMonths: 3,
      ccBal: 0,
      ccApr: 22,
      ccPayoffYears: 2,
      slBal: 0,
      slApr: 6.5,
      slPayoffYears: 10,
      autoBal: 0,
      autoApr: 7.5,
      autoPayoffYears: 4,
      currentAge: 35,
      retireAge: 65,
      retireIncomePct: 80,
      lifeExpectancy: 90,
      retirementBal: 0,
      has401k: false,
      matchPercent: 50,
      matchUpTo: 6,
      hasKids: false,
      numKids: 0,
      kidAges: [],
      collegeCostYear: 40000,
      collegeYears: 4,
      collegeBal: 0,
      brokerageBal: 0
    };

    const sanitizedInput = { ...defaults, ...input };

    // Ensure kidAges array matches numKids
    if (sanitizedInput.hasKids && sanitizedInput.numKids > 0) {
      while (sanitizedInput.kidAges.length < sanitizedInput.numKids) {
        sanitizedInput.kidAges.push(0);
      }
    }

    const results = calculate(sanitizedInput);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      body: JSON.stringify(results)
    };
  } catch (e) {
    console.error('Calculation error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: 'Calculation error' }) };
  }
};
