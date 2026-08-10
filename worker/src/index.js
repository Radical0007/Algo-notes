const GITHUB_API_VERSION = "2026-03-10";
const MAX_MARKDOWN_BYTES = 1024 * 1024;
const MAX_REQUEST_BYTES = 1400 * 1024;
const SESSION_TTL_SECONDS = 30 * 60;
const AUTO_UPLOADS_START = "<!-- AUTO_UPLOADS_START -->";
const AUTO_UPLOADS_END = "<!-- AUTO_UPLOADS_END -->";

export const PLATFORM_CONFIG = Object.freeze({
  codeforces: { label: "Codeforces", directory: "docs/solutions/codeforces" },
  nowcoder: { label: "牛客", directory: "docs/solutions/nowcoder" },
  luogu: { label: "洛谷", directory: "docs/solutions/luogu" },
  matiji: { label: "码蹄集", directory: "docs/solutions/matiji" },
  acwing: { label: "ACWing", directory: "docs/solutions/acwing" },
  others: { label: "其他", directory: "docs/solutions/others" }
});

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");

    if (!isAllowedOrigin(origin, env.ALLOWED_ORIGINS)) {
      return jsonResponse({ ok: false, error: "origin_not_allowed", message: "请求来源不在允许列表中。" }, 403, env, origin);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env, origin) });
    }

    const url = new URL(request.url);

    try {
      if (request.method === "GET" && url.pathname === "/health") {
        return jsonResponse({
          ok: true,
          service: "algo-notes-upload",
          configured: Boolean(env.ADMIN_PASSWORD && env.SESSION_SECRET && env.GITHUB_TOKEN)
        }, 200, env, origin);
      }

      if (request.method === "POST" && url.pathname === "/session") {
        return await createSession(request, env, origin);
      }

      if (request.method === "POST" && url.pathname === "/upload") {
        return await uploadMarkdown(request, env, origin);
      }

      return jsonResponse({ ok: false, error: "not_found", message: "接口不存在。" }, 404, env, origin);
    } catch (error) {
      if (error instanceof HttpError) {
        return jsonResponse({ ok: false, error: error.code, message: error.message }, error.status, env, origin);
      }

      console.error("Unhandled worker error", error);
      return jsonResponse({ ok: false, error: "internal_error", message: "服务器处理请求时出现错误。" }, 500, env, origin);
    }
  }
};

async function createSession(request, env, origin) {
  requireSecrets(env, ["ADMIN_PASSWORD", "SESSION_SECRET"]);
  const body = await readJson(request, 8 * 1024);

  if (typeof body.password !== "string" || body.password.length < 1 || body.password.length > 256) {
    throw new HttpError(400, "invalid_password", "请输入管理员密码。");
  }

  if (!(await secureTextEqual(body.password, env.ADMIN_PASSWORD))) {
    throw new HttpError(401, "invalid_credentials", "管理员密码不正确。");
  }

  const now = Date.now();
  const token = await createSessionToken(env.SESSION_SECRET, now);

  return jsonResponse({
    ok: true,
    token,
    expiresAt: new Date(now + SESSION_TTL_SECONDS * 1000).toISOString()
  }, 200, env, origin);
}

async function uploadMarkdown(request, env, origin) {
  requireSecrets(env, ["SESSION_SECRET", "GITHUB_TOKEN"]);

  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token || !(await verifySessionToken(token, env.SESSION_SECRET))) {
    throw new HttpError(401, "session_expired", "登录状态已失效，请重新登录。");
  }

  const body = await readJson(request, MAX_REQUEST_BYTES);
  const upload = validateUpload(body);
  const platform = PLATFORM_CONFIG[upload.platform];
  const relativePath = upload.subdirectory
    ? `${upload.subdirectory}/${upload.fileName}`
    : upload.fileName;
  const repositoryPath = `${platform.directory}/${relativePath}`;

  const existingFile = await getRepositoryContent(env, repositoryPath);
  if (existingFile && !upload.overwrite) {
    throw new HttpError(409, "file_exists", `文件已存在：${repositoryPath}`);
  }

  const fileResult = await putRepositoryContent(env, repositoryPath, {
    message: `docs: add ${platform.label} solution ${upload.fileName}`,
    content: upload.content,
    sha: existingFile?.sha
  });

  let indexUpdated = false;
  let warning = "";

  try {
    const indexPath = `${platform.directory}/index.md`;
    const indexFile = await getRepositoryContent(env, indexPath);
    if (!indexFile) {
      throw new Error(`Index file is missing: ${indexPath}`);
    }

    const updatedIndex = updateIndexContent(decodeBase64Utf8(indexFile.content), {
      title: upload.title,
      relativePath
    });

    if (updatedIndex !== decodeBase64Utf8(indexFile.content)) {
      await putRepositoryContent(env, indexPath, {
        message: `docs: update ${platform.label} solution index`,
        content: updatedIndex,
        sha: indexFile.sha
      });
    }
    indexUpdated = true;
  } catch (error) {
    console.error("Index update failed", error);
    warning = "题解文件已提交，但平台索引更新失败，需要手动检查 index.md。";
  }

  return jsonResponse({
    ok: true,
    path: repositoryPath,
    title: upload.title,
    commitUrl: fileResult.commit?.html_url || "",
    indexUpdated,
    warning
  }, indexUpdated ? 200 : 207, env, origin);
}

export function validateUpload(body) {
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "invalid_request", "上传请求格式不正确。");
  }

  if (!Object.hasOwn(PLATFORM_CONFIG, body.platform)) {
    throw new HttpError(400, "invalid_platform", "请选择有效的题目平台。");
  }

  if (typeof body.content !== "string") {
    throw new HttpError(400, "invalid_content", "Markdown 内容不能为空。");
  }

  const content = normalizeMarkdown(body.content);
  const contentBytes = new TextEncoder().encode(content).byteLength;
  if (contentBytes === 0 || contentBytes > MAX_MARKDOWN_BYTES) {
    throw new HttpError(400, "invalid_file_size", "Markdown 文件必须小于 1 MB。" );
  }

  const fileName = sanitizeMarkdownFileName(body.fileName);
  const subdirectory = sanitizeOptionalDirectory(body.subdirectory);
  const title = extractTitle(content, fileName);

  return {
    platform: body.platform,
    fileName,
    subdirectory,
    content,
    title,
    overwrite: body.overwrite === true
  };
}

export function extractTitle(content, fileName) {
  const match = content.match(/^#\s+(.+?)\s*#*\s*$/m);
  if (match) {
    return match[1].trim().slice(0, 160);
  }
  return fileName.replace(/\.md$/i, "").slice(0, 160);
}

export function sanitizeMarkdownFileName(value) {
  if (typeof value !== "string") {
    throw new HttpError(400, "invalid_file_name", "文件名不正确。");
  }

  let name = value.normalize("NFKC").trim();
  if (!/\.md$/i.test(name)) {
    name += ".md";
  }

  const base = name.slice(0, -3);
  const cleanBase = sanitizePathSegment(base, "文件名");
  const fileName = `${cleanBase}.md`;
  if (fileName.length > 140) {
    throw new HttpError(400, "invalid_file_name", "文件名不能超过 140 个字符。");
  }
  return fileName;
}

export function sanitizeOptionalDirectory(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return "";
  }
  const directory = sanitizePathSegment(String(value), "子目录");
  if (directory.length > 80) {
    throw new HttpError(400, "invalid_directory", "子目录不能超过 80 个字符。");
  }
  return directory;
}

function sanitizePathSegment(value, label) {
  if (/[\\/]/.test(value) || value.includes("..")) {
    throw new HttpError(400, "invalid_path", `${label}不能包含路径跳转字符。`);
  }

  const cleaned = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f<>:"|?*]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .replace(/^[.\s-]+|[.\s-]+$/g, "");

  if (!cleaned || cleaned === "." || cleaned === "..") {
    throw new HttpError(400, "invalid_path", `${label}不能为空。`);
  }
  return cleaned;
}

function normalizeMarkdown(content) {
  return content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").replace(/\s*$/, "\n");
}

export function updateIndexContent(source, entry) {
  const start = source.indexOf(AUTO_UPLOADS_START);
  const end = source.indexOf(AUTO_UPLOADS_END);
  if (start < 0 || end < 0 || end < start) {
    throw new Error("Automatic upload markers are missing from the platform index.");
  }

  const blockStart = start + AUTO_UPLOADS_START.length;
  const block = source.slice(blockStart, end);
  const entries = new Map();
  const linePattern = /^- \[(.+?)\]\(<(.+?)>\)$/gm;

  for (const match of block.matchAll(linePattern)) {
    entries.set(match[2], match[1]);
  }

  entries.set(entry.relativePath, escapeMarkdownLabel(entry.title));
  const lines = [...entries.entries()]
    .sort(([pathA], [pathB]) => pathA.localeCompare(pathB, "zh-CN", { numeric: true, sensitivity: "base" }))
    .map(([path, title]) => `- [${title}](<${path}>)`);

  const replacement = `\n${lines.join("\n")}\n`;
  return source.slice(0, blockStart) + replacement + source.slice(end);
}

function escapeMarkdownLabel(value) {
  return value.replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]").replace(/[\r\n]+/g, " ");
}

async function getRepositoryContent(env, path) {
  const response = await githubRequest(env, path, { method: "GET" });
  if (response.status === 404) {
    return null;
  }
  const data = await response.json();
  if (!response.ok) {
    throw githubError(response.status, data);
  }
  return data;
}

async function putRepositoryContent(env, path, { message, content, sha }) {
  const body = {
    message,
    content: encodeBase64Utf8(content),
    branch: env.GITHUB_BRANCH || "main"
  };
  if (sha) {
    body.sha = sha;
  }

  const response = await githubRequest(env, path, {
    method: "PUT",
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) {
    throw githubError(response.status, data);
  }
  return data;
}

async function githubRequest(env, path, init) {
  const owner = env.GITHUB_OWNER || "Radical0007";
  const repository = env.GITHUB_REPO || "Algo-notes";
  const branch = env.GITHUB_BRANCH || "main";
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const url = new URL(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/contents/${encodedPath}`);
  if (init.method === "GET") {
    url.searchParams.set("ref", branch);
  }

  return fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "algo-notes-upload-worker",
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
      ...(init.headers || {})
    }
  });
}

function githubError(status, data) {
  const message = typeof data?.message === "string" ? data.message : "GitHub API 请求失败。";
  if (status === 401 || status === 403) {
    return new HttpError(502, "github_auth_failed", "GitHub 凭据无效或没有仓库写入权限。");
  }
  if (status === 409 || status === 422) {
    return new HttpError(409, "github_conflict", `GitHub 拒绝了本次提交：${message}`);
  }
  return new HttpError(502, "github_error", `GitHub API 请求失败：${message}`);
}

export async function createSessionToken(secret, now = Date.now()) {
  const payload = encodeBase64Url(new TextEncoder().encode(JSON.stringify({
    exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS,
    nonce: crypto.randomUUID(),
    version: 1
  })));
  const signature = await signPayload(payload, secret);
  return `${payload}.${signature}`;
}

export async function verifySessionToken(token, secret, now = Date.now()) {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) {
    return false;
  }

  const expected = await signPayload(payload, secret);
  if (!(await secureTextEqual(signature, expected))) {
    return false;
  }

  try {
    const data = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload)));
    return data.version === 1 && Number.isFinite(data.exp) && data.exp > Math.floor(now / 1000);
  } catch {
    return false;
  }
}

async function signPayload(payload, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return encodeBase64Url(new Uint8Array(signature));
}

async function secureTextEqual(left, right) {
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(left)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(right))
  ]);
  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

function encodeBase64Utf8(value) {
  return bytesToBase64(new TextEncoder().encode(value));
}

function decodeBase64Utf8(value) {
  const normalized = value.replace(/\s/g, "");
  return new TextDecoder().decode(base64ToBytes(normalized));
}

function encodeBase64Url(bytes) {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return base64ToBytes(padded);
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function readJson(request, maxBytes) {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new HttpError(413, "request_too_large", "请求内容过大。");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "invalid_json", "请求内容不是有效的 JSON。" );
  }
}

function requireSecrets(env, names) {
  const missing = names.filter((name) => !env[name]);
  if (missing.length) {
    throw new HttpError(503, "worker_not_configured", `Worker 尚未配置：${missing.join(", ")}`);
  }
}

function isAllowedOrigin(origin, configuredOrigins) {
  if (!origin) {
    return true;
  }
  const allowed = String(configuredOrigins || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return allowed.includes(origin);
}

function corsHeaders(env, origin) {
  const headers = new Headers({
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    Vary: "Origin"
  });
  if (origin && isAllowedOrigin(origin, env.ALLOWED_ORIGINS)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return headers;
}

function jsonResponse(data, status, env, origin) {
  const headers = corsHeaders(env, origin);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { status, headers });
}

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}
