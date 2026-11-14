# Reports & Analytics — Phase 9 Forecast Foundation

## Delivered

- Added a pure, domain-neutral monthly linear-trend helper in [`forecastReport.ts`](../src/lib/forecastReport.ts).
- Forecast input requires one finite, non-negative value per month, at least three contiguous monthly observations, and a 1–12 month horizon.
- Output contains observed points, projected values, monthly trend, and historical residual error.
- Invalid values, duplicate months, sparse history, and invalid horizons are rejected or return an explicit ineligible state.

## Method and limitations

- Projections use ordinary least-squares linear regression over the supplied monthly values; projected values are bounded below by zero.
- The displayed planning range is ±1.96 times historical residual error. It is not a statistical confidence interval or a guarantee.
- The helper does not fill gaps, infer missing zeroes, convert currencies, or decide whether source data is complete.
