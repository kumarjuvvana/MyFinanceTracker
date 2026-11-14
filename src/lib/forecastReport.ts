export interface MonthlyValue {
  period: string;
  value: number;
}

export interface LinearTrendProjection {
  observed: MonthlyValue[];
  projected: MonthlyValue[];
  monthlyChange: number;
  residualError: number;
}

export type TrendProjectionResult =
  | { status: "ready"; projection: LinearTrendProjection }
  | { status: "insufficient-history"; message: string };

function monthNumber(period: string): number | null {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? year * 12 + month - 1 : null;
}

function periodFromMonthNumber(value: number): string {
  const year = Math.floor(value / 12);
  const month = value % 12 + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function projectLinearTrend(points: readonly MonthlyValue[], horizon = 3): TrendProjectionResult {
  if (!Number.isInteger(horizon) || horizon < 1 || horizon > 12) {
    throw new RangeError("Forecast horizon must be from 1 to 12 months.");
  }
  const ordered = [...points].sort((left, right) => left.period.localeCompare(right.period));
  if (ordered.some((point) => monthNumber(point.period) === null || !Number.isFinite(point.value) || point.value < 0)) {
    return { status: "insufficient-history", message: "Only valid, non-negative monthly values can be projected." };
  }
  if (new Set(ordered.map((point) => point.period)).size !== ordered.length) {
    return { status: "insufficient-history", message: "There must be one recorded value per month." };
  }
  if (ordered.length < 3) {
    return { status: "insufficient-history", message: "At least three monthly observations are required." };
  }
  const monthNumbers = ordered.map((point) => monthNumber(point.period) as number);
  if (monthNumbers.some((month, index) => index > 0 && month - monthNumbers[index - 1] !== 1)) {
    return { status: "insufficient-history", message: "A gap in monthly history prevents a conservative projection." };
  }

  const origin = monthNumbers[0];
  const xs = monthNumbers.map((month) => month - origin);
  const meanX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const meanY = ordered.reduce((sum, point) => sum + point.value, 0) / ordered.length;
  const denominator = xs.reduce((sum, value) => sum + (value - meanX) ** 2, 0);
  const monthlyChange = xs.reduce((sum, value, index) =>
    sum + (value - meanX) * (ordered[index].value - meanY), 0) / denominator;
  const intercept = meanY - monthlyChange * meanX;
  const residualError = Math.sqrt(ordered.reduce((sum, point, index) =>
    sum + (point.value - (intercept + monthlyChange * xs[index])) ** 2, 0) / ordered.length);
  const lastMonth = monthNumbers[monthNumbers.length - 1];
  return {
    status: "ready",
    projection: {
      observed: ordered,
      monthlyChange,
      residualError,
      projected: Array.from({ length: horizon }, (_, index) => {
        const month = lastMonth + index + 1;
        return {
          period: periodFromMonthNumber(month),
          value: Math.max(0, intercept + monthlyChange * (month - origin)),
        };
      }),
    },
  };
}
