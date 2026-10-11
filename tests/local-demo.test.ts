import { test } from "node:test";
import assert from "node:assert/strict";
import { localDemoBypassAllowed } from "../lib/local-demo";
const settings = {
  APP_MODE: "demo",
  NODE_ENV: "development",
  LOCAL_DEMO_BYPASS: "true",
};
test("entrada direta exige habilitação explícita e host local", () => {
  for (const host of ["127.0.0.1:3000", "localhost:3000", "[::1]:3000"])
    assert.equal(localDemoBypassAllowed(host, settings), true);
  for (const host of [
    null,
    "localhost.evil.test",
    "127.0.0.1.evil.test:3000",
    "192.168.1.5:3000",
    "demo.onrender.com",
  ])
    assert.equal(localDemoBypassAllowed(host, settings), false);
  assert.equal(localDemoBypassAllowed("localhost:3000", {}), false);
});
test("produção, build de produção e hospedagens nunca permitem entrada direta", () => {
  for (const change of [
    { APP_MODE: "production" },
    { NODE_ENV: "production" },
    { LOCAL_DEMO_BYPASS: "false" },
    { RENDER: "true" },
    { RENDER_EXTERNAL_URL: "https://demo.onrender.com" },
    { VERCEL: "1" },
    { CODESPACES: "true" },
  ])
    assert.equal(
      localDemoBypassAllowed("localhost:3000", { ...settings, ...change }),
      false,
    );
});
