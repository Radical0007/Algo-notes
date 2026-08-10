(() => {
  const config = window.ALGO_NOTES_ADMIN_CONFIG || {};
  const storageKeys = {
    api: "algo-notes-admin-api",
    token: "algo-notes-admin-session"
  };
  const state = { apiBaseUrl: "", token: "", files: [] };

  const $ = (selector) => document.querySelector(selector);
  const panels = {
    setup: $("[data-panel='setup']"),
    login: $("[data-panel='login']"),
    upload: $("[data-panel='upload']")
  };

  const normalizeApiUrl = (value) => {
    try {
      const url = new URL(value.trim());
      if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) {
        throw new Error("Only HTTPS endpoints are allowed");
      }
      return url.toString().replace(/\/$/, "");
    } catch {
      return "";
    }
  };

  const apiUrl = (path) => `${state.apiBaseUrl}${path}`;

  function showPanel(name) {
    Object.entries(panels).forEach(([key, panel]) => {
      panel.hidden = key !== name;
    });
  }

  function showResult(message, type = "info") {
    const result = $("#result");
    result.textContent = message;
    result.className = `result ${type}`;
  }

  function showLoginResult(message, type = "info") {
    const result = $("#login-result");
    result.textContent = message;
    result.className = `result ${type}`;
  }

  function showSetupOrLogin() {
    state.apiBaseUrl = normalizeApiUrl(
      localStorage.getItem(storageKeys.api) || config.apiBaseUrl || ""
    );
    $("#api-url").value = state.apiBaseUrl;
    if (!state.apiBaseUrl) {
      showPanel("setup");
      return;
    }
    state.token = sessionStorage.getItem(storageKeys.token) || "";
    showPanel(state.token ? "upload" : "login");
  }

  function renderFileList() {
    const list = $("#file-list");
    list.replaceChildren();
    state.files.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "file-row";
      const copy = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = item.file.name;
      const meta = document.createElement("span");
      meta.textContent = `${item.title} · ${formatBytes(item.file.size)}`;
      copy.append(title, meta);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-file";
      remove.textContent = "移除";
      remove.addEventListener("click", () => {
        state.files.splice(index, 1);
        renderFileList();
      });
      row.append(copy, remove);
      list.append(row);
    });
    $("#upload").disabled = state.files.length === 0;
  }

  async function addFiles(fileList) {
    const incoming = [...fileList];
    for (const file of incoming) {
      if (!file.name.toLowerCase().endsWith(".md")) {
        showResult(`已忽略非 Markdown 文件：${file.name}`, "error");
        continue;
      }
      if (file.size > 1024 * 1024) {
        showResult(`文件超过 1 MB：${file.name}`, "error");
        continue;
      }
      const content = await file.text();
      state.files.push({ file, content, title: extractTitle(content, file.name) });
    }
    renderFileList();
  }

  function extractTitle(content, fileName) {
    const match = content.match(/^#\s+(.+?)\s*#*\s*$/m);
    return match ? match[1].trim() : fileName.replace(/\.md$/i, "");
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  async function login(event) {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button");
    button.disabled = true;
    try {
      const response = await fetch(apiUrl("/session"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: $("#password").value })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "登录失败");
      state.token = data.token;
      sessionStorage.setItem(storageKeys.token, state.token);
      $("#password").value = "";
      showPanel("upload");
      showResult("登录成功，可以提交 Markdown。", "success");
    } catch (error) {
      showLoginResult(error.message, "error");
    } finally {
      button.disabled = false;
    }
  }

  async function uploadFiles() {
    const button = $("#upload");
    button.disabled = true;
    const platform = $("#platform").value;
    const subdirectory = $("#subdirectory").value.trim();
    const overwrite = $("#overwrite").checked;
    const total = state.files.length;
    const results = [];

    try {
      for (let index = 0; index < total; index += 1) {
        const item = state.files[index];
        showResult(`正在提交 ${index + 1}/${total}：${item.file.name}`, "info");
        const response = await fetch(apiUrl("/upload"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${state.token}`
          },
          body: JSON.stringify({
            platform,
            subdirectory,
            fileName: item.file.name,
            content: item.content,
            overwrite
          })
        });
        const data = await response.json();
        if (response.status === 401) {
          sessionStorage.removeItem(storageKeys.token);
          state.token = "";
          showPanel("login");
          throw new Error("登录状态已失效，请重新登录。");
        }
        if (!response.ok && response.status !== 207) {
          throw new Error(data.message || `提交失败：${item.file.name}`);
        }
        results.push(data);
      }
      state.files = [];
      renderFileList();
      const partial = results.some((item) => !item.indexUpdated);
      showResult(
        partial ? "文件已提交，但有平台索引未能同步，请检查 Worker 日志。" : `已提交 ${results.length} 个 Markdown 文件。`,
        partial ? "warning" : "success"
      );
    } catch (error) {
      showResult(error.message, "error");
    } finally {
      button.disabled = state.files.length === 0;
    }
  }

  function bindEvents() {
    $("#save-api").addEventListener("click", () => {
      const value = normalizeApiUrl($("#api-url").value);
      if (!value) {
        $("#api-url").focus();
        return;
      }
      localStorage.setItem(storageKeys.api, value);
      state.apiBaseUrl = value;
      showPanel("login");
    });

    $("#login-form").addEventListener("submit", login);
    $("#change-api").addEventListener("click", () => {
      sessionStorage.removeItem(storageKeys.token);
      state.token = "";
      $("#api-url").value = state.apiBaseUrl;
      showPanel("setup");
    });
    $("#upload").addEventListener("click", uploadFiles);
    $("#logout").addEventListener("click", () => {
      state.token = "";
      sessionStorage.removeItem(storageKeys.token);
      showPanel("login");
      showResult("已退出登录。", "info");
    });

    const dropzone = $("#dropzone");
    const input = $("#file-input");
    input.addEventListener("change", () => addFiles(input.files));
    ["dragenter", "dragover"].forEach((eventName) => dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add("dragging");
    }));
    ["dragleave", "drop"].forEach((eventName) => dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove("dragging");
    }));
    dropzone.addEventListener("drop", (event) => addFiles(event.dataTransfer.files));
    dropzone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") input.click();
    });
  }

  bindEvents();
  showSetupOrLogin();
})();
