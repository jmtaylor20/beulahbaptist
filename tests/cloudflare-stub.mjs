/**
 * Stand-in for the `cloudflare:workers` module, which only exists inside the
 * Workers runtime. The tests deliberately provide no bindings, so `env` is
 * empty and `getDb()` throws the same way it would on a deploy whose D1
 * binding is missing -- which is exactly the path the tests exercise.
 */
export const env = {};
export default { env };
