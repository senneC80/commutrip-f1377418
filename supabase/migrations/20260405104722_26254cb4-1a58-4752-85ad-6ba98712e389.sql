UPDATE activities
SET available_from = '2025-01-01', available_until = '2027-12-31'
WHERE recurrence_type = 'recurring' AND available_from IS NULL;