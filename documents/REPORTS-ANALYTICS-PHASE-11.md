# Reports & Analytics — Phase 11 Saved Views

## Delivered

- Named, filter-specific views for Shopping, Finance & investments, Assets, Subscriptions, and Forecasts.
- Saved views can be reopened in their report section and removed from the Saved reports page.
- Each saved view stores only a bounded name, report section, filter strings, and creation timestamp.
- The list is capped at 20 views and validated with the existing `TrackerData` preferences validator.

## Persistence

- Saved views and the optional savings goal use the existing shared-preferences JSON and `saveSharedPreferences` PATCH path.
- No table, column, migration, or new API endpoint was added.
- Saved views remain private to the authenticated Daybook account; they do not publish or share access with other users.
