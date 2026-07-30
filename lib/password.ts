// A valid cost-10 bcrypt hash for a fixed, non-secret dummy value. Comparing
// against it keeps the unknown-account path close to the real-account path
// without ever authenticating a user.
export const DUMMY_PASSWORD_HASH =
  "$2b$10$1E9RDfD8.8xVyNqqxaqxIumWQHP1nG5V34A1vfNdcDo0Rr8rVZPaO";
