# Algo Notes Upload Worker

这个 Worker 为 GitHub Pages 提供一个受管理员密码保护的 Markdown 上传接口。

浏览器只会拿到一个短期会话令牌；GitHub Token 只保存在 Cloudflare Worker Secret 中，不写入前端，也不提交到仓库。

## 1. 创建 GitHub Token

创建一个 Fine-grained personal access token，并设置：

- Repository access：只允许 `Radical0007/Algo-notes`
- Repository permissions：`Contents` 设置为 `Read and write`
- 设置合理的过期时间，建议不要永久有效

Token 只用于 Worker 调用 GitHub Contents API 创建或更新 Markdown 文件。

## 2. 安装 Wrangler 并登录 Cloudflare

在 `worker/` 目录执行：

```powershell
npm install
npx wrangler login
```

## 3. 配置 Secret

以下命令会交互式读取 Secret，输入内容不会写入仓库：

```powershell
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET
npx wrangler secret put GITHUB_TOKEN
```

`ADMIN_PASSWORD` 建议使用至少 16 位的随机密码。

`SESSION_SECRET` 用于签名短期登录令牌，可以先生成随机值：

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

把输出复制到 `SESSION_SECRET` 的输入提示中即可。

## 4. 部署

```powershell
npx wrangler deploy
```

部署完成后会得到一个类似下面的地址：

```text
https://algo-notes-upload.<your-subdomain>.workers.dev
```

打开站点的 `/admin/`，在首次配置页面输入这个地址。地址只保存在当前浏览器的 `localStorage` 中。

如果希望预先写入地址，可以修改 `docs/admin/config.js` 中的 `apiBaseUrl`，然后重新构建站点。

## 5. 本地测试

复制 `.dev.vars.example` 为 `.dev.vars`，填入本地测试用的值：

```powershell
Copy-Item .dev.vars.example .dev.vars
npx wrangler dev
```

不要提交 `.dev.vars`。根目录 `.gitignore` 已经忽略该文件。

## 上传范围

Worker 只允许写入以下目录：

```text
docs/solutions/codeforces/
docs/solutions/nowcoder/
docs/solutions/luogu/
docs/solutions/matiji/
docs/solutions/acwing/
docs/solutions/others/
```

每次上传会先提交题解文件，再更新对应平台的 `index.md` 中的自动索引区块。
