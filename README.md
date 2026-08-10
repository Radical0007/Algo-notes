# Algo Notes

算法题解、竞赛模板、专题训练与比赛复盘的静态文档站。

## 本地预览

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
mkdocs serve
```

浏览器打开 `http://127.0.0.1:8000/` 即可预览。

## 内容目录

| 内容 | 目录 |
| --- | --- |
| 刷题题解 | `docs/solutions/` |
| 算法专题 | `docs/blog/`、`docs/topics/` |
| 算法模板 | `docs/algorithm-templates/` |
| 比赛复盘 | `docs/contests/` |

## 管理员上传

站点提供独立的管理员上传页，访问站点的 `/admin/` 路径即可打开。上传服务代码位于 `worker/`，部署和 Secret 配置说明见 [worker/README.md](worker/README.md)。
