# Firebase Security Specification

## 1. Data Invariants
- **User profiles** must have unique usernames, matching standard roles: Administrator (Admin), Pharmacist, Nurse, Doctor, Clerk.
- **Drugs** must have uppercase unique stockCodes (e.g., GEN001) with pricing fields: employee, opd, ipd, and it.
- **Bookings** must follow the standard ID grouping: `RXN-YYYYMMDD-COUNT` and require the hospital number input HN (following `02-xx-xxxxxx` format), patientName, doctor, and nurse names.
- **System trace logs** must record the exact timestamp, actorId, and action to prevent accountability spoofing.

## 2. The "Dirty Dozen" Payloads (Vulnerability Scenarios)
1. User registration without username.
2. User updating their authorization role to Admin from a non-admin session.
3. Injecting a massive string (1MB) as user ID to bypass resource boundaries.
4. Booking creation with missing mandatory Patient Name field.
5. Deleting custom medication items by standard guest users.
6. Booking with an arbitrarily high quantity of Oncology medications.
7. Injecting non-matching characters in drug stockCode.
8. Writing system audit logs as arbitrary user accounts.
9. Modifying terminal status states of orders after Ready-to-use verification.
10. Directly modifying patient HN to bypass format validation checks.
11. Reading PII details of other patients from outside the clinic network context.
12. Creating duplicate stock elements under existing warehouse records.

## 3. Deployment Safety Guards
Security is guaranteed through Firestore security rules and backend validation. All payloads must return `PERMISSION_DENIED` unless properly verified.
