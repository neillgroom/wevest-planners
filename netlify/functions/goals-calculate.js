// Goals Planner Calculation Engine
// All financial formulas, Social Security PIA, and binary search optimizer

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
// 2025 SOCIAL SECURITY PIA CALCULATION
// =============================================
const SS = {
  bendPoint1: 1226,
  bendPoint2: 7391,
  rate1: 0.90,
  rate2: 0.32,
  rate3: 0.15,
  maxBenefitFRA: 4018,
  fra: 67,
  era: 62,
  maxAge: 70,
  delayCredit: 0.08,
  spousalMult: 1.5,
};

const getSSBenefit = (income, married, retireAge) => {
  const mi = income / 12;
  let pia;
  if (mi <= SS.bendPoint1) {
    pia = SS.rate1 * mi;
  } else if (mi <= SS.bendPoint2) {
    pia = SS.rate1 * SS.bendPoint1 + SS.rate2 * (mi - SS.bendPoint1);
  } else {
    pia = SS.rate1 * SS.bendPoint1 + SS.rate2 * (SS.bendPoint2 - SS.bendPoint1) + SS.rate3 * (mi - SS.bendPoint2);
  }
  pia = Math.min(pia, SS.maxBenefitFRA);
  let benefit = married ? pia * SS.spousalMult : pia;

  if (retireAge < SS.fra && retireAge >= SS.era) {
    const me = (SS.fra - retireAge) * 12;
    const reduction = me <= 36 ? me * (5/9) / 100 : 36 * (5/9) / 100 + (me - 36) * (5/12) / 100;
    benefit *= (1 - reduction);
  } else if (retireAge > SS.fra && retireAge <= SS.maxAge) {
    benefit *= Math.pow(1 + SS.delayCredit, Math.min(retireAge - SS.fra, 3));
  }
  return benefit;
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
    income, married,
    emergencyBal, emergencyMonths,
    ccBal, ccApr, ccPayoffYears,
    slBal, slApr, slPayoffYears,
    autoBal, autoApr, autoPayoffYears,
    currentAge, retireAge, retireIncomePct, lifeExpectancy,
    retirementBal, has401k, matchPercent, matchUpTo,
    hasKids, numKids, kidAges,
    collegeCostYear, collegeYears, collegeBal,
    useFinancialAid, aidPercent,
    brokerageBal
  } = input;

  const grossMonthly = income / 12;
  const afterTaxMonthly = grossMonthly * (1 - TAX_RATE);

  // Emergency Fund
  const emergencyTarget = afterTaxMonthly * emergencyMonths;
  const emergencyGap = Math.max(0, emergencyTarget - emergencyBal);
  const emergencyMonthlyContrib = emergencyGap > 0 ? Math.max(100, emergencyGap / 6) : 0;

  // Debts (sorted by APR, highest first — avalanche method)
  const debts = [];
  if (ccBal > 0) {
    const pmt = LoanPMT(ccBal, ccApr / 100, ccPayoffYears * 12);
    const totalPaid = pmt * ccPayoffYears * 12;
    debts.push({
      name: 'Credit Card', balance: ccBal, apr: ccApr / 100, years: ccPayoffYears,
      months: ccPayoffYears * 12, monthlyPmt: pmt, totalInterest: totalPaid - ccBal, color: '#c62828'
    });
  }
  if (autoBal > 0) {
    const pmt = LoanPMT(autoBal, autoApr / 100, autoPayoffYears * 12);
    const totalPaid = pmt * autoPayoffYears * 12;
    debts.push({
      name: 'Auto Loan', balance: autoBal, apr: autoApr / 100, years: autoPayoffYears,
      months: autoPayoffYears * 12, monthlyPmt: pmt, totalInterest: totalPaid - autoBal, color: '#e65100'
    });
  }
  if (slBal > 0) {
    const pmt = LoanPMT(slBal, slApr / 100, slPayoffYears * 12);
    const totalPaid = pmt * slPayoffYears * 12;
    debts.push({
      name: 'Student Loan', balance: slBal, apr: slApr / 100, years: slPayoffYears,
      months: slPayoffYears * 12, monthlyPmt: pmt, totalInterest: totalPaid - slBal, color: '#5e35b1'
    });
  }
  debts.sort((a, b) => b.apr - a.apr);
  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
  const totalDebtPmt = debts.reduce((s, d) => s + d.monthlyPmt, 0);
  const totalDebtInterest = debts.reduce((s, d) => s + d.totalInterest, 0);

  // Retirement — with Social Security PIA
  const yearsToRetire = Math.max(1, retireAge - currentAge);
  const monthsToRetire = yearsToRetire * 12;
  const yearsInRetirement = Math.max(1, lifeExpectancy - retireAge);
  const monthsInRetirement = yearsInRetirement * 12;
  const accumulationROR = getROR(yearsToRetire);

  const retireIncomeAnnual = income * (retireIncomePct / 100);
  const ssBenefit = getSSBenefit(income, married, Math.max(retireAge, SS.era));
  const ssAnnual = ssBenefit * 12;
  const incomeNeededAnnual = Math.max(0, retireIncomeAnnual - ssAnnual);

  const retireIncomeMonthly = incomeNeededAnnual / 12;
  const ssStartAge = Math.max(retireAge, SS.era);
  const monthsWithSS = (lifeExpectancy - ssStartAge) * 12;

  let retireTarget = PVAnnuity(retireIncomeMonthly, RETIRE_DRAWDOWN_RATE, monthsWithSS);
  if (retireAge < SS.era) {
    const gapMonths = (SS.era - retireAge) * 12;
    retireTarget += PVAnnuity(retireIncomeAnnual / 12, RETIRE_DRAWDOWN_RATE, gapMonths);
  }

  const retireFVofCurrent = FV(retirementBal, accumulationROR, monthsToRetire);
  const retireGap = Math.max(0, retireTarget - retireFVofCurrent);
  const retireMonthlyNeeded = PMTforFV(retireGap, accumulationROR, monthsToRetire);

  const monthlyMatchableContrib = has401k ? (income * (matchUpTo / 100)) / 12 : 0;
  const monthlyMatchReceived = has401k ? monthlyMatchableContrib * (matchPercent / 100) : 0;

  // College
  const effectiveCost = useFinancialAid ? collegeCostYear * (1 - aidPercent / 100) : collegeCostYear;
  const collegeGoals = [];
  let totalCollegeMonthly = 0;
  if (hasKids && numKids > 0) {
    for (let i = 0; i < numKids; i++) {
      const age = kidAges[i] || 0;
      const yearsUntil = Math.max(1, 18 - age);
      const monthsUntil = yearsUntil * 12;
      const ror = getROR(yearsUntil);
      const calc = calculateCollegeTarget(effectiveCost, collegeYears, yearsUntil);
      const perChildSaved = collegeBal / numKids;
      const fvSaved = FV(perChildSaved, ror, monthsUntil);
      const gap = Math.max(0, calc.pvNeeded - fvSaved);
      const monthly = PMTforFV(gap, ror, monthsUntil);
      totalCollegeMonthly += monthly;
      collegeGoals.push({
        childNum: i + 1, age, yearsUntil, monthsUntil, ror,
        target: calc.pvNeeded, futureCost: calc.futureCostPerYear, currentSaved: perChildSaved,
        fvSaved, gap, monthly
      });
    }
  }

  // Naive total
  const naiveTotalMonthly = emergencyMonthlyContrib + totalDebtPmt + monthlyMatchableContrib +
    totalCollegeMonthly + Math.max(0, retireMonthlyNeeded - monthlyMatchableContrib - monthlyMatchReceived);

  // =============================================
  // BINARY SEARCH OPTIMIZER
  // =============================================
  const simulate = (budget) => {
    let emergency = emergencyBal;
    let debtStates = debts.map(d => ({ ...d, balance: d.balance }));
    let retirement = retirementBal;
    let collegeAccts = hasKids && collegeGoals.length > 0
      ? collegeGoals.map(c => ({ ...c, balance: c.currentSaved })) : [];
    let brokerage = brokerageBal;
    const timeline = [];
    const maxMonths = Math.max(monthsToRetire, ...debts.map(d => d.months),
      ...(hasKids ? collegeGoals.map(c => c.monthsUntil) : []), 480);

    for (let month = 0; month <= maxMonths; month++) {
      let available = budget;

      // Growth
      if (month > 0) {
        for (let d of debtStates) { if (d.balance > 0) d.balance *= (1 + d.apr / 12); }
        if (month <= monthsToRetire) retirement *= (1 + accumulationROR / 12);
        for (let c of collegeAccts) { if (month < c.monthsUntil) c.balance *= (1 + c.ror / 12); }
        brokerage *= (1 + 0.07 / 12);
      }

      // 1. Emergency Fund
      if (emergency < emergencyTarget && available > 0) {
        const amt = Math.min(available, Math.max(100, (emergencyTarget - emergency) / 6));
        emergency += amt; available -= amt;
      }
      // 2. Debt Payments (avalanche: highest APR first)
      for (let d of debtStates) {
        if (d.balance > 0 && available > 0) {
          const pmt = Math.min(available, d.monthlyPmt, d.balance);
          d.balance = Math.max(0, d.balance - pmt); available -= pmt;
        }
      }
      // 3. 401k Match
      if (has401k && available > 0 && month < monthsToRetire) {
        const contrib = Math.min(available, monthlyMatchableContrib);
        retirement += contrib + contrib * (matchPercent / 100);
        available -= contrib;
      }
      // 4. College Savings
      if (hasKids) {
        for (let c of collegeAccts) {
          if (available <= 0 || month >= c.monthsUntil) continue;
          const contrib = Math.min(available, c.monthly);
          c.balance += contrib; available -= contrib;
        }
      }
      // 5. Additional Retirement
      if (available > 0 && month < monthsToRetire) {
        retirement += available; available = 0;
      }
      // 6. Brokerage overflow
      if (available > 0) { brokerage += available; }

      // Yearly snapshot
      if (month % 12 === 0) {
        timeline.push({
          month, year: new Date().getFullYear() + Math.floor(month / 12),
          age: currentAge + Math.floor(month / 12),
          emergency: Math.round(emergency),
          totalDebt: Math.round(debtStates.reduce((s, d) => s + d.balance, 0)),
          retirement: Math.round(retirement),
          college: Math.round(collegeAccts.reduce((s, c) => s + c.balance, 0)),
          brokerage: Math.round(brokerage),
          netWorth: Math.round(emergency + retirement + collegeAccts.reduce((s, c) => s + c.balance, 0) +
            brokerage - debtStates.reduce((s, d) => s + d.balance, 0)),
        });
      }

      // Goal check
      const eMet = emergency >= emergencyTarget * 0.95;
      const dMet = debtStates.every(d => d.balance < 1);
      const rMet = month >= monthsToRetire && retirement >= retireTarget * 0.90;
      let cMet = true;
      if (hasKids) {
        for (let c of collegeAccts) {
          if (month >= c.monthsUntil && c.balance < c.target * 0.90) { cMet = false; break; }
        }
      }
      if (eMet && dMet && rMet && cMet && month >= monthsToRetire) {
        return { success: true, timeline, finalRetirement: retirement };
      }
    }
    let finalCMet = true;
    if (hasKids) {
      for (let c of collegeAccts) { if (c.balance < c.target * 0.90) finalCMet = false; }
    }
    return {
      success: emergency >= emergencyTarget * 0.95 && debtStates.every(d => d.balance < 1) &&
        retirement >= retireTarget * 0.90 && finalCMet,
      timeline,
      finalRetirement: retirement
    };
  };

  // Binary search
  let lo = Math.max(100, naiveTotalMonthly * 0.3);
  let hi = Math.max(afterTaxMonthly * 0.95, naiveTotalMonthly * 2);
  let bestBudget = hi, bestTimeline = [];
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const result = simulate(mid);
    if (result.success) { bestBudget = mid; bestTimeline = result.timeline; hi = mid - 1; }
    else { lo = mid + 1; }
    if (hi - lo < 5) break;
  }
  const finalResult = simulate(bestBudget);
  if (finalResult.success) bestTimeline = finalResult.timeline;

  return {
    afterTaxMonthly,
    minimumMonthly: Math.round(bestBudget),
    savingsRate: (bestBudget / afterTaxMonthly) * 100,
    naiveTotalMonthly,
    efficiencySavings: Math.max(0, naiveTotalMonthly - bestBudget),
    timeline: bestTimeline,
    emergencyTarget,
    emergencyGap,
    emergencyMonthlyContrib,
    debts,
    totalDebt,
    totalDebtPmt,
    totalDebtInterest,
    retireTarget,
    retireGap,
    retireMonthlyNeeded,
    retireFVofCurrent,
    accumulationROR,
    yearsToRetire,
    monthsToRetire,
    retireIncomeAnnual,
    ssBenefit,
    ssAnnual,
    incomeNeededAnnual,
    monthlyMatchableContrib,
    monthlyMatchReceived,
    collegeGoals,
    totalCollegeMonthly,
    totalAssets: emergencyBal + retirementBal + collegeBal + brokerageBal,
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

    // Apply defaults for optional fields
    const defaults = {
      married: false,
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
      useFinancialAid: false,
      aidPercent: 25,
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
