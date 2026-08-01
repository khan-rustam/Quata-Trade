-- Remove the QA sign-up probe accounts (email LIKE 'qa-signup-check-%').
--
-- WHY THIS IS A SCRIPT AND NOT AN ENDPOINT
-- There is no user-deletion path in the application, deliberately: `users` is
-- referenced by 17 foreign keys, several on money paths (accounts.owner_user_id
-- is a LEDGER account; deposits; withdrawals; trades). Deleting a real user is
-- not a supported operation and must never become one.
--
-- These probe accounts are safe to remove ONLY because they never transacted.
-- The guard in step 2 enforces that rather than trusting it: if any matching
-- account has a ledger account, deposit address, deposit, withdrawal, trade,
-- offer, dispute, chat message or KYC submission, the whole transaction aborts
-- and nothing is deleted.
--
-- BEFORE RUNNING
--   1. Take a backup and confirm it restores (pgBackRest). This is a DELETE on
--      production and there is no undo inside the app.
--   2. Run step 1 on its own first and read the list.
--
-- NOT REMOVED ON PURPOSE
--   audit_logs rows. That table is append-only and hash-chained (prev_hash /
--   row_hash); deleting rows forks the chain and makes verifyChain() report
--   tampering forever. It has NO foreign key to users, so the delete below
--   succeeds with the audit trail intact — that is the correct outcome, not an
--   oversight. Same for `outbox`, whose payload is JSON rather than an FK.
--
-- VERIFIED, NOT JUST WRITTEN
--   backend/src/db/cleanup-qa-accounts.integration.spec.ts runs this exact file
--   against a real PG16 with the real migrations and asserts both halves: clean
--   probes (plus their auth_tokens/notifications) are removed and a non-matching
--   account survives; a matching account WITH ledger history aborts the whole
--   run and deletes nothing — including its innocent siblings.
--
-- USAGE — always PIPE the file, never `-f`.
--
--   Under `sudo -u postgres psql -f FILE`, psql runs AS the postgres role and
--   opens FILE itself. postgres cannot traverse /home/<you> (mode 750), so it
--   fails with "Permission denied" — a FILE read error, not a database error.
--   Piping makes your own shell open the file and hand over the descriptor.
--
--   1. DRY RUN (ends in ROLLBACK — changes nothing, prints what would go):
--        sudo -u postgres psql quatatrade -v ON_ERROR_STOP=1 < /tmp/cleanup-qa-signup-accounts.sql
--
--   2. APPLY (swaps the trailing ROLLBACK for COMMIT on the way in, so the
--      file on disk stays a safe dry run):
--        sed 's/^ROLLBACK;.*/COMMIT;/' /tmp/cleanup-qa-signup-accounts.sql \
--          | sudo -u postgres psql quatatrade -v ON_ERROR_STOP=1
--
--   ON_ERROR_STOP=1 is REQUIRED, not decorative. When the step-2 guard raises,
--   the transaction is left open and aborted; ON_ERROR_STOP makes psql exit at
--   that point, closing the connection and rolling back implicitly. Without it
--   psql keeps reading and every later statement fails with "current transaction
--   is aborted" — noisy, but still no data change.

BEGIN;

-- 1. What will be removed. Read this before committing.
SELECT id, email, status, created_at, email_verified_at
FROM users
WHERE email LIKE 'qa-signup-check-%'
ORDER BY created_at;

-- 2. Refuse to run if any matching account ever touched a money path, KYC or a trade.
DO $$
DECLARE
  dirty int;
BEGIN
  SELECT count(*) INTO dirty
  FROM users u
  WHERE u.email LIKE 'qa-signup-check-%'
    AND (
      EXISTS (SELECT 1 FROM accounts          a  WHERE a.owner_user_id = u.id) OR
      EXISTS (SELECT 1 FROM deposit_addresses da WHERE da.user_id      = u.id) OR
      EXISTS (SELECT 1 FROM deposits          d  WHERE d.user_id       = u.id) OR
      EXISTS (SELECT 1 FROM withdrawals       w  WHERE w.user_id       = u.id) OR
      EXISTS (SELECT 1 FROM offers            o  WHERE o.user_id       = u.id) OR
      EXISTS (SELECT 1 FROM trades            t  WHERE t.buyer_id = u.id OR t.seller_id = u.id) OR
      EXISTS (SELECT 1 FROM disputes          di WHERE di.opened_by    = u.id) OR
      EXISTS (SELECT 1 FROM trade_messages    tm WHERE tm.sender_id    = u.id) OR
      EXISTS (SELECT 1 FROM kyc_submissions   k  WHERE k.user_id       = u.id)
    );

  IF dirty > 0 THEN
    RAISE EXCEPTION
      'ABORT: % qa-signup-check account(s) have ledger/deposit/withdrawal/trade/dispute/KYC history. These are not disposable probes — inspect them by hand.', dirty;
  END IF;
END $$;

-- 3. Dependent rows first — there is no ON DELETE CASCADE anywhere on users.
--    Only the tables a never-transacted account can populate are listed; the
--    money-path tables are covered by the guard above, not deleted here.
DELETE FROM auth_tokens          WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'qa-signup-check-%');
DELETE FROM notifications        WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'qa-signup-check-%');
DELETE FROM sessions             WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'qa-signup-check-%');
DELETE FROM risk_events          WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'qa-signup-check-%');
DELETE FROM watchlists           WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'qa-signup-check-%');
DELETE FROM price_alerts         WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'qa-signup-check-%');
DELETE FROM withdrawal_addresses WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'qa-signup-check-%');

-- 4. The accounts themselves. Any FK this script missed raises here and the
--    whole transaction rolls back — that is the intended failure mode.
DELETE FROM users WHERE email LIKE 'qa-signup-check-%';

-- 5. Confirm zero remain, then COMMIT (or ROLLBACK if anything looks wrong).
SELECT count(*) AS remaining FROM users WHERE email LIKE 'qa-signup-check-%';

-- COMMIT;
ROLLBACK;  -- <- flip to COMMIT once step 1 and step 5 both read correctly
