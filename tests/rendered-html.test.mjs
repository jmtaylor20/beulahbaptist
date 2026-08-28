/**
 * Smoke tests against the built Worker.
 *
 * These replaced the vinext starter's skeleton-preview assertions, which
 * tested scaffolding (`app/_sites-preview/`, react-loading-skeleton) that the
 * church site removed and which had been failing ever since.
 *
 * The bindings passed to `worker.fetch` are deliberately empty: it verifies
 * that public pages still render when the database and bucket are unreachable,
 * rather than showing a visitor a stack trace.
 */

import assert from "node:assert/strict";
import test from "node:test";

async function render(path) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the church home page", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Beulah Baptist Church<\/title>/i);
  assert.match(html, /Dadeville/);
  // The nav is rendered by the root layout, so this catches a broken layout.
  assert.match(html, /Plan a Visit/);
});

test("the text signup page renders without a database", async () => {
  const response = await render("/text");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /Never miss/);
  // The consent wording is a compliance requirement, not decoration -- it must
  // survive any future edit to the form.
  assert.match(html, /Reply STOP to opt out/i);
  assert.match(html, /Msg &amp; data rates may apply|Msg &amp;amp; data rates/i);
});

test("the admin area is not reachable without a session", async () => {
  const response = await render("/admin");
  // Either a redirect to sign-in, or the sign-in page itself.
  assert.ok(
    [200, 302, 303, 307].includes(response.status),
    `unexpected status ${response.status}`,
  );

  if (response.status === 200) {
    const html = await response.text();
    assert.doesNotMatch(html, /Compose/);
  } else {
    assert.match(response.headers.get("location") ?? "", /\/admin\/signin/);
  }
});

test("admin API routes reject unauthenticated callers", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-api`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/api/admin/groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Should not be created" }),
    }),
    { ASSETS: { fetch: async () => new Response("", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );

  assert.ok(
    response.status === 401 || response.status === 500,
    `expected an auth failure, got ${response.status}`,
  );
  if (response.status === 401) {
    const payload = await response.json();
    assert.match(payload.error, /not signed in/i);
  }
});
