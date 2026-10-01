// Parses req.body with a zod schema; on failure replies 400 with the first
// problem, phrased for display to the user.
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const issue = result.error.issues[0];
      return res.status(400).json({ error: issue.message, field: issue.path.join('.') || undefined });
    }
    req.body = result.data;
    next();
  };
}

module.exports = validate;
