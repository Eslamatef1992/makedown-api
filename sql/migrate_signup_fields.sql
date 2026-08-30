-- Adds first name / last name / birth date to users for the redesigned Sign Up form.
-- full_name is kept and still populated (first_name + " " + last_name) so every
-- existing query/report that reads full_name keeps working unchanged.
ALTER TABLE users
  ADD COLUMN first_name VARCHAR(100) NULL AFTER full_name,
  ADD COLUMN last_name  VARCHAR(100) NULL AFTER first_name,
  ADD COLUMN birth_date DATE NULL AFTER last_name;
