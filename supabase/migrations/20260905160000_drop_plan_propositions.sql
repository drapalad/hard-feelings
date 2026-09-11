-- Calendar pending Accept lived in plan_propositions; leftover rows intercepted profile/freeze Accept.
-- Worker rollback does not undo this SQL.

DROP TABLE IF EXISTS plan_propositions CASCADE;
