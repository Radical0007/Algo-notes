import test from "node:test";
import assert from "node:assert/strict";

import {
  createSessionToken,
  extractTitle,
  sanitizeMarkdownFileName,
  sanitizeOptionalDirectory,
  updateIndexContent,
  verifySessionToken
} from "../src/index.js";
import worker from "../src/index.js";

test("extracts the first level-one heading", () => {
  assert.equal(extractTitle("# CF1000A Example\n\nText\n", "fallback.md"), "CF1000A Example");
  assert.equal(extractTitle("Text only\n", "fallback.md"), "fallback");
});

test("sanitizes file names and rejects path traversal", () => {
  assert.equal(sanitizeMarkdownFileName("A: Example.md"), "A- Example.md");
  assert.equal(sanitizeMarkdownFileName("solution"), "solution.md");
  assert.throws(() => sanitizeMarkdownFileName("../secret.md"));
  assert.throws(() => sanitizeOptionalDirectory("CF2209/../../x"));
});

test("updates and sorts the automatic index block", () => {
  const source = `# Index\n\n<!-- AUTO_UPLOADS_START -->\n暂无已发布题解。\n<!-- AUTO_UPLOADS_END -->\n`;
  const first = updateIndexContent(source, { title: "B Array", relativePath: "CF1/B Array.md" });
  const second = updateIndexContent(first, { title: "A Test", relativePath: "CF1/A Test.md" });
  assert.match(second, /- \[A Test\]\(<CF1\/A Test\.md>\)\n- \[B Array\]\(<CF1\/B Array\.md>\)/);
});

test("creates verifiable short-lived session tokens", async () => {
  const now = Date.now();
  const token = await createSessionToken("test-secret-value", now);
  assert.equal(await verifySessionToken(token, "test-secret-value", now + 1000), true);
  assert.equal(await verifySessionToken(token, "wrong-secret", now + 1000), false);
  assert.equal(await verifySessionToken(token, "test-secret-value", now + 31 * 60 * 1000), false);
});

test("upload endpoint commits a file and updates its platform index", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const env = {
    ADMIN_PASSWORD: "test-password",
    SESSION_SECRET: "test-session-secret",
    GITHUB_TOKEN: "github-token",
    GITHUB_OWNER: "Radical0007",
    GITHUB_REPO: "Algo-notes",
    GITHUB_BRANCH: "main",
    ALLOWED_ORIGINS: "https://radical0007.github.io"
  };
  const indexSource = "# Codeforces\n\n<!-- AUTO_UPLOADS_START -->\n<!-- AUTO_UPLOADS_END -->\n";
  const indexContent = Buffer.from(indexSource, "utf8").toString("base64");

  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, method: init.method || "GET", body: init.body ? JSON.parse(init.body) : null });
    if (url.includes("contents/docs/solutions/codeforces/index.md") && init.method === "GET") {
      return new Response(JSON.stringify({ sha: "index-sha", content: indexContent }), { status: 200 });
    }
    if (url.includes("contents/docs/solutions/codeforces/CFTEST/new.md") && init.method === "GET") {
      return new Response("missing", { status: 404 });
    }
    if (init.method === "PUT") {
      return new Response(JSON.stringify({ commit: { html_url: "https://github.com/Radical0007/Algo-notes/commit/test" } }), { status: 201 });
    }
    throw new Error(`Unexpected GitHub request: ${url}`);
  };

  try {
    const token = await createSessionToken(env.SESSION_SECRET);
    const request = new Request("https://upload.example.workers.dev/upload", {
      method: "POST",
      headers: {
        Origin: "https://radical0007.github.io",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        platform: "codeforces",
        subdirectory: "CFTEST",
        fileName: "new.md",
        content: "# New Test\n\n## Idea\n\nA short solution.\n"
      })
    });
    const response = await worker.fetch(request, env);
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.path, "docs/solutions/codeforces/CFTEST/new.md");
    assert.equal(data.indexUpdated, true);
    assert.equal(calls.filter((call) => call.method === "PUT").length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
