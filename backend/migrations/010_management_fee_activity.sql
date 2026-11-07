ALTER TABLE payments ADD COLUMN IF NOT EXISTS lesson_amount_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS management_fee_cents INTEGER NOT NULL DEFAULT 0;

UPDATE payments
SET lesson_amount_cents = amount_cents
WHERE lesson_amount_cents = 0 AND amount_cents > 0;
