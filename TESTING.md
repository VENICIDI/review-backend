# 接口测试（curl）（自测均已通过）

本文档用于通过 `curl` 验证本项目各个 HTTP 接口的正确性。

## 0. 前置条件

- 服务已启动（默认端口 `3000`）：

```bash
npm i
npm run start
```

- 默认服务地址：

```bash
export BASE_URL='http://localhost:3000'
```

- 可选：建议安装 `jq` 方便校验 JSON（macOS 可用 Homebrew 安装）。
- 可选：建议安装SQLite Viewer插件在编辑器里可视化数据库。

## 1. 冒烟测试

### 1.1 健康检查

- **接口**：`GET /`

```bash
curl -sS -i "$BASE_URL/"
```

- **期望**：
  - HTTP 状态码 `200`
  - Body 为 `Hello World!`

## 2. 评论接口测试（完整流程）

说明：本项目使用 SQLite 文件数据库，首次启动会自动建表。评论接口依赖文章存在；项目内置 `articles` 表，但**没有提供创建文章的 HTTP 接口**。

因此建议你用一种方式确保存在 `articleId=1`：

- **方式 A（推荐）**：使用你已有的 DB（`db.sqlite`）里已经存在的文章 ID。
- **方式 B**：删除 `db.sqlite` 后重启服务，再手动往 `articles` 表插入一条记录（例如用 SQLite 客户端）。

下面示例默认使用：

```bash
export ARTICLE_ID=1
```

### 2.1 对文章发表评论（顶层）

- **接口**：`POST /articles/:articleId/comments`

```bash
curl -sS -i -X POST "$BASE_URL/articles/$ARTICLE_ID/comments" \
  -H 'Content-Type: application/json' \
  --data '{"content":"顶层评论-1","authorId":9}'
```

- **期望**：
  - HTTP 状态码 `201`
  - 返回 JSON 包含 `comment.id`（记下来，后续要用）

- **保存返回的顶层评论 id（可选，需 jq）**：

```bash
export TOP_COMMENT_ID=$(curl -sS -X POST "$BASE_URL/articles/$ARTICLE_ID/comments" \
  -H 'Content-Type: application/json' \
  --data '{"content":"顶层评论-2","authorId":9}' | jq -r '.comment.id')

echo "TOP_COMMENT_ID=$TOP_COMMENT_ID"
```

### 2.2 回复某条评论

- **接口**：`POST /comments/:commentId/replies`

```bash
curl -sS -i -X POST "$BASE_URL/comments/$TOP_COMMENT_ID/replies" \
  -H 'Content-Type: application/json' \
  --data '{"content":"回复-1","authorId":9}'
```

- **期望**：
  - HTTP 状态码 `201`
  - 返回的 `comment.parentId == $TOP_COMMENT_ID`

- **保存返回的回复评论 id（可选，需 jq）**：

```bash
export REPLY_ID=$(curl -sS -X POST "$BASE_URL/comments/$TOP_COMMENT_ID/replies" \
  -H 'Content-Type: application/json' \
  --data '{"content":"回复-2","authorId":9}' | jq -r '.comment.id')

echo "REPLY_ID=$REPLY_ID"
```

### 2.3 分页获取文章的顶层评论

- **接口**：`GET /articles/:articleId/comments`

#### 2.3.1 第一页

```bash
curl -sS -i "$BASE_URL/articles/$ARTICLE_ID/comments?limit=20&order=desc"
```

- **期望**：
  - HTTP 状态码 `200`
  - JSON 包含 `items` 数组
  - JSON 可能包含 `nextCursor`（有下一页时）

#### 2.3.2 使用 nextCursor 拉取下一页（可选）

如果上一步返回了 `nextCursor`，可用如下方式继续请求（需 jq）：

```bash
export NEXT_CURSOR=$(curl -sS "$BASE_URL/articles/$ARTICLE_ID/comments?limit=2&order=desc" | jq -r '.nextCursor')

echo "NEXT_CURSOR=$NEXT_CURSOR"

curl -sS -i "$BASE_URL/articles/$ARTICLE_ID/comments?limit=2&order=desc&cursor=$NEXT_CURSOR"
```

- **期望**：
  - HTTP 状态码 `200`
  - 返回 `items` 为下一页数据

### 2.4 分页获取文章的顶层评论（带 children 预览）

- **接口**：`GET /articles/:articleId/comments/preview`

```bash
curl -sS -i "$BASE_URL/articles/$ARTICLE_ID/comments/preview?limit=20&order=desc"
```

- **期望**：
  - HTTP 状态码 `200`
  - `items[*].children` 存在（最多 2 条）

### 2.5 分页获取某条评论的直接子评论

- **接口**：`GET /comments/:commentId/children`

```bash
curl -sS -i "$BASE_URL/comments/$TOP_COMMENT_ID/children?limit=20&order=asc"
```

- **期望**：
  - HTTP 状态码 `200`
  - `items` 中每一项的 `parentId == $TOP_COMMENT_ID`

### 2.6 获取某条评论的完整子树（一次拉取）

- **接口**：`GET /comments/:commentId/tree`

```bash
curl -sS -i "$BASE_URL/comments/$TOP_COMMENT_ID/tree"
```

- **期望**：
  - HTTP 状态码 `200`
  - JSON 包含 `comment`
  - `comment.children` 为该评论的子树

### 2.7 软删除评论

- **接口**：`DELETE /comments/:commentId`

```bash
curl -sS -i -X DELETE "$BASE_URL/comments/$REPLY_ID"
```

- **期望**：
  - HTTP 状态码 `204`
  - 无响应 body

#### 2.7.1 删除后验证（可选）

删除后再次拉取树，应该看到被删评论的 `content` 变为占位文案 `该评论已删除`：

```bash
curl -sS "$BASE_URL/comments/$TOP_COMMENT_ID/tree" | jq '.comment'
```

## 3. 参数与错误用例验证

### 3.1 顶层评论分页：limit 非数字

- **接口**：`GET /articles/:articleId/comments?limit=abc`

```bash
curl -sS -i "$BASE_URL/articles/$ARTICLE_ID/comments?limit=abc"
```

- **期望**：HTTP `400`，错误信息包含 `limit must be a number`。

### 3.2 顶层评论分页：order 非法

```bash
curl -sS -i "$BASE_URL/articles/$ARTICLE_ID/comments?order=xxx"
```

- **期望**：HTTP `400`，错误信息包含 `order must be asc or desc`。

### 3.3 顶层评论分页：cursor 非法

```bash
curl -sS -i "$BASE_URL/articles/$ARTICLE_ID/comments?cursor=not-a-valid-cursor"
```

- **期望**：HTTP `400`，错误信息包含 `cursor is invalid`。

### 3.4 创建顶层评论：content 为空（应失败）

```bash
curl -sS -i -X POST "$BASE_URL/articles/$ARTICLE_ID/comments" \
  -H 'Content-Type: application/json' \
  --data '{"content":"","authorId":9}'
```

- **期望**：HTTP `400`。

### 3.5 回复评论：父评论不存在（应失败）

```bash
curl -sS -i -X POST "$BASE_URL/comments/99999999/replies" \
  -H 'Content-Type: application/json' \
  --data '{"content":"reply","authorId":9}'
```

- **期望**：HTTP `404`。

### 3.6 删除评论：评论不存在（应失败）

```bash
curl -sS -i -X DELETE "$BASE_URL/comments/99999999"
```

- **期望**：HTTP `404`。
