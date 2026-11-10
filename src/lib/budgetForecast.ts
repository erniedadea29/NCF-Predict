import { RandomForestRegressor } from './randomForest';
import type {
  ActiveSemester,
  DepartmentCode,
  DepartmentInfo,
  ForecastDepartment,
  ForecastMetric
} from '../types';

/** Number of months tracked per semester (e.g. Aug–Dec or Jan–May). */
export const SEMESTER_MONTHS = 5;

/** One department's spending for one past semester. */
export interface HistoricalSemesterSpending {
  school_year: string;
  department: DepartmentCode;
  allocated: number;
  /** Cumulative amount spent at the end of month 1..SEMESTER_MONTHS. */
  monthly_cumulative: number[];
}

const DEPT_ORDER: DepartmentCode[] = ['CAF', 'CAS', 'CBM', 'CCJE', 'CCS', 'COE', 'CHS', 'CTED'];

export const FORECAST_FEATURES = [
  { key: 'department', label: 'Department' },
  { key: 'allocated', label: 'Allocated budget' },
  { key: 'months_elapsed', label: 'Months elapsed' },
  { key: 'target_month', label: 'Target month' },
  { key: 'util_to_date', label: 'Utilization to date' },
  { key: 'prior_year_util', label: 'Prior-year utilization' }
] as const;

const RF_OPTIONS = { nTrees: 100, maxDepth: 10, minSamplesLeaf: 3, maxFeatures: 4, seed: 42 };

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function featureRow(
  dept: DepartmentCode,
  allocated: number,
  monthsElapsed: number,
  targetMonth: number,
  utilToDate: number,
  priorYearUtil: number
): number[] {
  return [DEPT_ORDER.indexOf(dept), allocated, monthsElapsed, targetMonth, utilToDate, priorYearUtil];
}

/** Final utilization (spent / allocated) of a history record. */
const finalUtil = (r: HistoricalSemesterSpending) =>
  r.allocated > 0 ? r.monthly_cumulative[SEMESTER_MONTHS - 1] / r.allocated : 0;

function sortedYears(history: HistoricalSemesterSpending[]): string[] {
  return [...new Set(history.map(h => h.school_year))].sort();
}

/** Prior-year final utilization for a department, falling back to the global mean. */
function priorUtilLookup(history: HistoricalSemesterSpending[]) {
  const years = sortedYears(history);
  const globalMean = history.length ? history.reduce((s, r) => s + finalUtil(r), 0) / history.length : 0.9;
  return (dept: DepartmentCode, beforeYear: string | null): number => {
    const candidates = years.filter(y => beforeYear === null || y < beforeYear);
    for (let i = candidates.length - 1; i >= 0; i--) {
      const rec = history.find(h => h.department === dept && h.school_year === candidates[i]);
      if (rec) return finalUtil(rec);
    }
    return globalMean;
  };
}

/**
 * Every history record expands into SEMESTER_MONTHS × SEMESTER_MONTHS rows:
 * "standing at month j with X% spent, how much more (or less, for k < j) of the
 * budget is cumulatively used by month k?"
 */
function buildTrainingSet(records: HistoricalSemesterSpending[], allHistory: HistoricalSemesterSpending[]) {
  const priorUtil = priorUtilLookup(allHistory);
  const X: number[][] = [];
  const y: number[] = [];
  const meta: { record: HistoricalSemesterSpending; j: number; k: number }[] = [];
  for (const r of records) {
    if (r.allocated <= 0) continue;
    const prior = priorUtil(r.department, r.school_year);
    for (let j = 1; j <= SEMESTER_MONTHS; j++) {
      const utilToDate = r.monthly_cumulative[j - 1] / r.allocated;
      for (let k = 1; k <= SEMESTER_MONTHS; k++) {
        X.push(featureRow(r.department, r.allocated, j, k, utilToDate, prior));
        // Target: change in cumulative utilization between month j and month k.
        y.push(r.monthly_cumulative[k - 1] / r.allocated - utilToDate);
        meta.push({ record: r, j, k });
      }
    }
  }
  return { X, y, meta };
}

interface HoldoutMetrics {
  rmse: number;
  mae: number;
  mape: number;
  r2: number;
  /** Std-dev of utilization residuals; widens prediction intervals. */
  residualUtilStd: number;
}

/** Train on all but the latest school year, test end-of-semester predictions on the latest. */
function evaluateHoldout(history: HistoricalSemesterSpending[]): HoldoutMetrics {
  const years = sortedYears(history);
  if (years.length < 2) return { rmse: 0, mae: 0, mape: 0, r2: 0, residualUtilStd: 0.05 };

  const testYear = years[years.length - 1];
  const train = buildTrainingSet(history.filter(h => h.school_year !== testYear), history);
  const test = buildTrainingSet(history.filter(h => h.school_year === testYear), history);
  const model = new RandomForestRegressor(RF_OPTIONS).fit(train.X, train.y);

  const actual: number[] = [];
  const predicted: number[] = [];
  const utilResiduals: number[] = [];
  test.meta.forEach((m, i) => {
    // Only score genuine forecasts: final month, seen from months 1..(n-1).
    if (m.k !== SEMESTER_MONTHS || m.j === SEMESTER_MONTHS) return;
    const utilToDate = test.X[i][4];
    const predUtil = utilToDate + model.predict(test.X[i]);
    const actualUtil = utilToDate + test.y[i];
    utilResiduals.push(actualUtil - predUtil);
    actual.push(actualUtil * m.record.allocated);
    predicted.push(predUtil * m.record.allocated);
  });

  const n = actual.length;
  const errors = actual.map((a, i) => a - predicted[i]);
  const mae = errors.reduce((s, e) => s + Math.abs(e), 0) / n;
  const rmse = Math.sqrt(errors.reduce((s, e) => s + e * e, 0) / n);
  const mape = (actual.reduce((s, a, i) => s + (a ? Math.abs(errors[i] / a) : 0), 0) / n) * 100;
  const meanActual = actual.reduce((s, a) => s + a, 0) / n;
  const ssTot = actual.reduce((s, a) => s + (a - meanActual) ** 2, 0);
  const ssRes = errors.reduce((s, e) => s + e * e, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  const residualUtilStd = Math.sqrt(utilResiduals.reduce((s, e) => s + e * e, 0) / Math.max(1, utilResiduals.length));

  return {
    rmse: Math.round(rmse),
    mae: Math.round(mae),
    mape: Math.round(mape * 10) / 10,
    r2: Math.round(r2 * 1000) / 1000,
    residualUtilStd
  };
}

/** Where the active semester is today: which calendar months it covers and how many have elapsed. */
export function semesterPosition(activeSemester: ActiveSemester, now: Date) {
  const isSecond = /2nd|second/i.test(activeSemester.semester_name);
  const startMonth = isSecond ? 0 : 7; // Jan or Aug
  const offset = now.getMonth() - startMonth;
  const monthsElapsed = Math.min(SEMESTER_MONTHS, Math.max(1, offset + 1));
  const monthLabels = Array.from({ length: SEMESTER_MONTHS }, (_, i) => MONTH_NAMES[(startMonth + i) % 12]);
  const syStart = Number(activeSemester.school_year_label.match(/(\d{4})/)?.[1] ?? now.getFullYear());
  const calendarYear = isSecond ? syStart + 1 : syStart;
  return { startMonth, monthsElapsed, monthLabels, calendarYear };
}

export function buildRandomForestForecast(params: {
  departments: Record<DepartmentCode, DepartmentInfo>;
  history: HistoricalSemesterSpending[];
  activeSemester: ActiveSemester;
  now?: Date;
}): ForecastMetric {
  const { departments, history, activeSemester } = params;
  const now = params.now ?? new Date();
  const { monthsElapsed, monthLabels } = semesterPosition(activeSemester, now);

  const holdout = evaluateHoldout(history);
  const full = buildTrainingSet(history, history);
  const model = new RandomForestRegressor(RF_OPTIONS).fit(full.X, full.y);
  const priorUtil = priorUtilLookup(history);

  const historicalUtilByMonth = Array.from({ length: SEMESTER_MONTHS }, (_, m) => {
    const vals = history.filter(h => h.allocated > 0).map(h => h.monthly_cumulative[m] / h.allocated);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  });

  const deptRows: ForecastDepartment[] = DEPT_ORDER.filter(code => departments[code]).map(code => {
    const info = departments[code];
    const allocated = info.allocated;
    const spent = info.spent;
    if (allocated <= 0) {
      return {
        code, name: info.name, allocated, spent, forecast: spent, diff: spent - allocated,
        confidence: 0, status: 'No Allocation', lower: spent, upper: spent,
        trajectory: Array.from({ length: SEMESTER_MONTHS }, () => ({ predicted: spent, lower: spent, upper: spent }))
      };
    }
    const utilToDate = spent / allocated;
    const prior = priorUtil(code, null);

    let runningMax = 0;
    const trajectory = Array.from({ length: SEMESTER_MONTHS }, (_, i) => {
      const k = i + 1;
      const { mean, std } = model.predictWithSpread(featureRow(code, allocated, monthsElapsed, k, utilToDate, prior));
      const sigma = Math.sqrt(std * std + holdout.residualUtilStd ** 2) * allocated;
      let predicted = (utilToDate + mean) * allocated;
      // Money already spent can't be un-spent, and the cumulative curve never decreases.
      if (k === monthsElapsed) predicted = spent;
      if (k > monthsElapsed) predicted = Math.max(predicted, spent);
      predicted = Math.max(predicted, runningMax);
      runningMax = predicted;
      const band = k === monthsElapsed ? 0 : 1.96 * sigma;
      return {
        predicted: Math.round(predicted),
        lower: Math.round(Math.max(k >= monthsElapsed ? spent : 0, predicted - band)),
        upper: Math.round(predicted + band)
      };
    });

    const final = trajectory[SEMESTER_MONTHS - 1];
    const relHalfWidth = final.predicted > 0 ? (final.upper - final.predicted) / final.predicted : 1;
    const confidence = Math.round(Math.min(99, Math.max(50, 100 * (1 - relHalfWidth))));
    const status =
      final.predicted > allocated ? 'Deficit Risk' :
      final.predicted < allocated * 0.85 ? 'Under-utilization' :
      'On Track';

    return {
      code,
      name: info.name,
      allocated,
      spent,
      forecast: final.predicted,
      diff: final.predicted - allocated,
      confidence,
      status,
      lower: final.lower,
      upper: final.upper,
      trajectory
    };
  });

  return {
    rmse: holdout.rmse,
    mae: holdout.mae,
    mape: holdout.mape,
    r2: holdout.r2,
    model_name: 'Random Forest Regressor',
    training_years: sortedYears(history).length,
    n_trees: model.treeCount,
    months_elapsed: monthsElapsed,
    month_labels: monthLabels,
    historical_util_by_month: historicalUtilByMonth,
    feature_importances: FORECAST_FEATURES.map((f, i) => ({
      feature: f.key,
      label: f.label,
      importance: model.featureImportances[i] ?? 0
    })).sort((a, b) => b.importance - a.importance),
    departments: deptRows
  };
}
