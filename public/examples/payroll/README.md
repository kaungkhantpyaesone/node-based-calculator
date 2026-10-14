# Payroll sample graphs

Open any of the three JSON files with the calculator's **Open** button. They use the same 37 nodes, 57 connections, expressions, and positions; only numeric input values differ. Inputs are on the left, component calculations and controls are in the middle, and **net_salary** is at the far right.

All monetary inputs are fictional sample amounts in MMK. The summary is displayed to two decimal places; the files retain the calculator's normal floating-point arithmetic without adding rounding operations.

| File                                  | Working days | Overtime (MMK) | SSB (MMK) | Net salary (MMK) |
| ------------------------------------- | -----------: | -------------: | --------: | ---------------: |
| 01-supervisor-paid-leave.json         |           26 |      34,615.38 |  5,200.00 |       347,582.05 |
| 02-above-supervisor-unpaid-leave.json |           24 |      25,000.00 |  6,000.00 |       780,771.71 |
| 03-supervisor-unpaid-leave.json       |           25 |     125,000.00 |  6,000.00 |       739,717.95 |

## Inputs and rules

- `overtime_category`: **0 = supervisor**, **1 = above supervisor**. There is no contract option.
- Supervisor overtime uses `overtime_multiplier * ((basic_salary * months_in_year) / (weeks_in_year * hours_in_week)) * overtime_hours`.
- Above-supervisor overtime uses the single monthly `precalculated_overtime` input. Daily overtime iteration is omitted.
- `working_days = attendance_days + paid_leave_days`. Credited working days are at most 26 in each sample. Paid leave counts as work; unpaid leave is recorded separately.
- `working_days_in_month` is the scheduled monthly working-day count, set to 26. It is used for the allowance unpaid-leave denominator.
- Earned salary uses `(basic_salary / days_in_month) * working_days`.
- The salary unpaid-leave formula is preserved as supplied: `((basic_salary * months_in_year) / (weeks_in_year * working_days)) * unpaid_leave_days`. Here `working_days` is the monthly credited count, as requested.
- Fixed, cost-of-living, transportation, and relocation allowances are prorated by credited days and each deduct `(unpaid_leave_days / working_days_in_month) * monthly_allowance_of_type`. The shared `allowance_unpaid_leave_fraction` supplies that ratio. Other allowance is prorated without that extra deduction, matching the original table.
- `deduction` and `tax` are single subtracting inputs; no tax brackets or annual tax calculations are included.
- SSB follows the supplied rule: earned salary below 300000 uses 2%; otherwise SSB is 6000.
- Final salary is `earned_salary + overtime + allowance - deduction - unpaid_leave - tax - ssb`.

Scenario 1 exercises supervisor overtime and uncapped SSB. Scenario 2 exercises above-supervisor overtime, two unpaid leave days, and capped SSB. Scenario 3 exercises supervisor overtime, one unpaid leave day, and capped SSB.
