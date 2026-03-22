# Algo-notes
网页访问：https://radical0007.github.io/Algo-notes/

# 网站内容放置说明

* **刷题题解** 放到 `docs/solutions/` 对应平台目录下
* **算法博客** 放到 `docs/blog/`
* **算法模板** 放到 `docs/templates/`
* **专题总结** 放到 `docs/topics/`
* **比赛复盘** 放到 `docs/contests/`

---

## 目录对应关系

### 1）刷题题解

```text
docs/solutions/codeforces/
docs/solutions/nowcoder/
docs/solutions/luogu/
docs/solutions/matiji/
docs/solutions/acwing/
docs/solutions/others/
```

对应关系如下：

* Codeforces 题解 → `docs/solutions/codeforces/`
* 牛客题解 → `docs/solutions/nowcoder/`
* 洛谷题解 → `docs/solutions/luogu/`
* 码蹄集题解 → `docs/solutions/matiji/`
* ACWing 题解 → `docs/solutions/acwing/`
* 其他平台题解 → `docs/solutions/others/`

### 2）博客

```text
docs/blog/
```

### 3）模板
```text
docs/templates/
```

### 4）专题训练

```text
docs/topics/
```

### 5）比赛复盘

```text
docs/contests/
```

---

# 新增内容

## 新增一道题解

例新增一道 Codeforces 题解。

### 第一步：新建文件

放到：

```text
docs/solutions/codeforces/
```

比如新文件名：

```text
docs/solutions/codeforces/cf-1900A.md
```

### 第二步：写内容

例如：

```md
# CF 1900A - 题目名

## 题目链接

## 题意

## 思路

## 代码

## 复杂度

## 反思
```

### 第三步：更新该平台首页

打开：

```text
docs/solutions/codeforces/index.md
```

在里面加一个链接，比如：

```md
# Codeforces 题解

这里整理 Codeforces 的刷题题解。

- [CF 1900A - 题目名](./cf-1900A/)
```


---

## 情况二：新增一篇博客

例“二分答案”。

### 第一步：新建文件

放到：

```text
docs/blog/
```

例如：

```text
docs/blog/binary-search-answer.md
```

### 第二步：写内容

### 第三步：更新博客首页

打开：

```text
docs/blog/index.md
```

加一条：

```md
# 博客算法思想

这里记录一些题目之外的算法思想、套路总结和建模经验。

- [二分答案](./binary-search-answer/)
```

---

## 新增一个模板

例如你要加并查集模板。

新建：

```text
docs/templates/union-find.md
```

然后更新：

```text
docs/templates/index.md
```

加：

```md
- [并查集](./union-find/)
```

---

## 新增一个专题

例如你要加“单调栈专题”。

新建：

```text
docs/topics/monotonic-stack.md
```

然后更新：

```text
docs/topics/index.md
```

加：

```md
- [单调栈专题](./monotonic-stack/)
```

---

## 新增比赛复盘

例如你参加了一场比赛。

新建：

```text
docs/contests/cf-round-xxx.md
```

然后更新：

```text
docs/contests/index.md
```

加：

```md
- [Codeforces Round XXX 复盘](./cf-round-xxx/)
```

---


