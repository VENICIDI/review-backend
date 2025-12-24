# 文章无限评论服务端系统设计（SQLite + 扁平化评论树）

## 0. 目标与范围

本设计用于支持：

- **对文章评论**：任意用户可以在文章下发布评论。
- **评论其他评论**：评论可以无限层级回复，形成评论树。
- **数据库**：使用 **SQLite**。
- **评论树实现方式**：使用**扁平化建模**：`comments.root_id + comments.depth + comments.parent_id`，查询按 `root_id` 拉取后在内存中组装评论树。

---

## 1. 数据库设计

### 1.1 核心表

#### 1.1.1 `articles`

用于承载评论的对象（文章）。如你已有文章表，可仅保留 `comments.article_id` 外键约束即可。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | INTEGER | PK | 文章ID |
| `title` | TEXT | NOT NULL | 标题 |
| `created_at` | TEXT | NOT NULL | ISO8601 |
| `updated_at` | TEXT | NOT NULL | ISO8601 |
| `comment_count` | INTEGER | NOT NULL DEFAULT 0 | 冗余计数（可选，用于列表展示） |

#### 1.1.2 `comments`

评论表：通过 `parent_id` 表达父子关系；通过 `root_id` 将同一棵评论树聚合到同一个查询集合；通过 `depth` 记录层级（不限制最大深度）。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | INTEGER | PK | 评论ID |
| `article_id` | INTEGER | NOT NULL, FK | 所属文章 |
| `root_id` | INTEGER | NOT NULL, FK | 所属评论树根ID（顶层评论 `root_id = id`） |
| `parent_id` | INTEGER | NULL, FK | 父评论ID，顶层评论为 NULL |
| `depth` | INTEGER | NOT NULL | 层级，顶层为 0，子评论为父评论 `depth + 1`（不限制） |
| `author_id` | INTEGER | NULL | 作者（可选） |
| `content` | TEXT | NOT NULL | 评论内容 |
| `status` | INTEGER | NOT NULL DEFAULT 1 | 1=正常，0=隐藏/屏蔽（可选） |
| `is_deleted` | INTEGER | NOT NULL DEFAULT 0 | 软删除标记（推荐） |
| `created_at` | TEXT | NOT NULL | ISO8601 |
| `updated_at` | TEXT | NOT NULL | ISO8601 |

关键约束与语义：

- **顶层评论**：`parent_id IS NULL` 且 `article_id` 指向文章。
- **回复评论**：`parent_id` 指向同一 `article_id` 下的某条评论。
- **根聚合字段**：顶层评论创建后，保证 `root_id = id`；回复评论的 `root_id = parent.root_id`。
- **层级字段**：`depth` 用于快速过滤/排序/分析，但不作为最大深度限制（无限层级是需求）。
- **删除策略**：推荐**软删除**，避免删除父节点导致子树失联；软删除后内容可返回占位（例如“该评论已删除”）。

### 1.2 DDL（SQLite）

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS articles (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  comment_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  root_id    INTEGER NOT NULL,
  parent_id  INTEGER NULL,
  depth      INTEGER NOT NULL,
  author_id  INTEGER NULL,
  content    TEXT NOT NULL,
  status     INTEGER NOT NULL DEFAULT 1,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE,
  FOREIGN KEY(parent_id)  REFERENCES comments(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_comments_article_created
  ON comments(article_id, created_at);

CREATE INDEX IF NOT EXISTS idx_comments_root_created
  ON comments(root_id, created_at);

CREATE INDEX IF NOT EXISTS idx_comments_root_depth_created
  ON comments(root_id, depth, created_at);

CREATE INDEX IF NOT EXISTS idx_comments_article_parent_created
  ON comments(article_id, parent_id, created_at);

CREATE INDEX IF NOT EXISTS idx_comments_parent
  ON comments(parent_id);
```

约束选择说明：

- **`articles` 删除级联**：文章删除时，其下评论全删（`ON DELETE CASCADE`）。
- **`parent_id` 使用 `RESTRICT`**：防止误物理删除父评论导致子评论变成孤儿。结合软删除可以更稳。

补充说明：

- **`root_id` 不做外键**：SQLite 下顶层评论通常需要“先插入拿到自增 id，再回填 `root_id=id`”。若对 `root_id` 增加自引用外键，会导致首次插入时无法满足约束，因此这里不设置外键，仅依赖业务层保证一致性。
- **顶层评论的 `root_id` 回填**：插入顶层评论后再执行一次更新将 `root_id` 置为自身 `id`（用事务保证一致性）。

### 1.3 评论树查询（按 root_id 扁平查询 + 内存组装）

推荐主路径：数据库只负责按索引过滤与排序，服务端一次性拉取同一棵树的所有节点，然后在内存中组装为树结构。

#### 1.3.1 查询某文章下以某条评论为根的整棵树（一次查询）

```sql
SELECT *
FROM comments
WHERE article_id = :article_id
  AND root_id = :root_id
ORDER BY created_at ASC;
```

组装方式（概念）：

- 先建立 `id -> node` 的 Map
- 再遍历一次，按 `parent_id` 把节点挂到父节点的 `children`

#### 1.3.2 何时不一次性拉全树

无限层级不代表必须一次性返回全量数据。当某个 `root_id` 下评论量极大时，可以：

- 仍然使用 `root_id` 过滤，但结合游标分页逐段加载
- 或继续使用“分页顶层 + 按需加载 children”的接口方式

### 1.4 分页与排序策略

- **顶层评论分页**：基于 `(created_at, id)` 做游标分页。
- **子评论分页**：基于 `(article_id, parent_id, created_at, id)` 的稳定排序（利用索引前缀）。
- **排序**：`asc|desc` 可选，默认 `desc`（最新优先）或按产品需求。

---

## 2. 接口设计

接口风格：REST + JSON。

### 2.1 数据模型（响应结构）

#### 2.1.1 Comment

```json
{
  "id": 123,
  "articleId": 1,
  "parentId": 45,
  "authorId": 9,
  "content": "...",
  "status": 1,
  "isDeleted": 0,
  "createdAt": "2025-12-24T07:00:00Z",
  "updatedAt": "2025-12-24T07:00:00Z"
}
```

软删除返回约定（推荐）：

- `isDeleted=1` 时 `content` 返回固定占位文案 `"该评论已删除"`。

### 2.2 创建评论 / 回复

#### 2.2.1 对文章发表评论（顶层）

- **POST** `/articles/{articleId}/comments`

Request:

```json
{
  "content": "hello",
  "authorId": 9
}
```

Response `201`:

```json
{ "comment": { "id": 1, "articleId": 1, "parentId": null, "content": "hello" } }
```

#### 2.2.2 回复某条评论

- **POST** `/comments/{commentId}/replies`

Request:

```json
{
  "content": "reply",
  "authorId": 9
}
```

Response `201`:

```json
{ "comment": { "id": 2, "articleId": 1, "parentId": 1, "content": "reply" } }
```

服务端校验：

- `commentId` 必须存在。
- 生成的子评论 `article_id` 必须与父评论一致（服务端从父评论读取，不信任客户端传参）。

### 2.3 查询评论

#### 2.3.1 分页获取文章的顶层评论

- **GET** `/articles/{articleId}/comments`

Query:

- `limit`：默认 20，最大 100
- `cursor`：游标（推荐编码 `(created_at, id)`）
- `order`：`asc|desc`（默认 `desc`）

Response `200`:

```json
{
  "items": [ { "id": 1, "parentId": null, "content": "..." } ],
  "nextCursor": "..."
}
```

#### 2.3.2 分页获取某条评论的直接子评论

- **GET** `/comments/{commentId}/children`

Query:

- `limit`：默认 20，最大 100
- `cursor`：游标
- `order`：`asc|desc`

Response `200`:

```json
{
  "items": [ { "id": 2, "parentId": 1, "content": "reply" } ],
  "nextCursor": "..."
}
```

#### 2.3.3 获取某条评论的完整子树（慎用）

- **GET** `/comments/{commentId}/tree`

Response `200`:

```json
{ "items": [ { "id": 1 }, { "id": 2 } ] }
```

### 2.4 删除评论

- **DELETE** `/comments/{commentId}`

推荐语义：软删除。

Response：`204 No Content`

### 2.5 统一错误码（示例）

- `404`：文章/评论不存在
- `400`：参数错误（`limit` 超限、content 为空等）
- `409`：冲突（例如：父评论不可回复、状态不允许回复等）

---

## 3. 模块设计

推荐采用分层架构，便于测试与替换存储实现：

- **HTTP 层（Handler/Controller）**
  - 解析参数、校验基本格式
  - 调用 Service
  - 组装响应（DTO）
- **业务层（Service）**
  - 业务规则校验（是否允许回复、删除策略）
  - 事务边界控制
  - 组合多个 Repository 操作（例如写入评论 + 更新 `article.comment_count`）
- **数据访问层（Repository/DAO）**
  - 仅负责 SQL 与对象映射
  - 提供分页查询与递归查询
- **基础设施层（DB/Migrations）**
  - SQLite 连接管理
  - 启用 `PRAGMA foreign_keys = ON`
  - schema 迁移

Repository 建议方法集合（示例）：

- `CreateTopLevelComment(articleId, authorId, content)`
- `CreateReply(parentCommentId, authorId, content)`
- `ListTopLevelComments(articleId, cursor, limit, order)`
- `ListChildren(commentId, cursor, limit, order)`
- `GetCommentById(commentId)`
- `SoftDeleteComment(commentId)`
- `GetCommentTree(commentId, maxDepth?)`（可选）

---

## 4. 流程设计

### 4.1 发表评论（顶层）流程

1. Handler 校验：`articleId` 为正整数，`content` 非空。
2. Service 开启事务：
   - 校验文章存在（可选）
   - 插入 `comments`：`parent_id=NULL`
   - （可选）更新 `articles.comment_count += 1`
3. 提交事务，返回 `201`。

### 4.2 回复评论流程

1. Handler 校验：`commentId`、`content`。
2. Service 事务内：
   - 查询父评论（拿到父评论的 `article_id`）
   - 校验父评论状态是否允许回复
   - 插入子评论：`article_id=父评论.article_id`，`parent_id=父评论.id`
   - （可选）更新 `articles.comment_count += 1`
3. 提交事务，返回 `201`。

### 4.3 拉取评论列表（推荐“分两段加载”）

- **步骤 A：加载顶层评论分页**：`GET /articles/{id}/comments`
- **步骤 B：展开节点时加载 children**：`GET /comments/{commentId}/children`

### 4.4 删除评论流程（软删除）

1. Handler 校验 `commentId`。
2. Service 事务内：
   - 查询评论是否存在
   - 更新 `is_deleted=1`、`updated_at=now`
3. 返回 `204`。

---

## 5. 关键实现细节与风险

- **全量拉取边界**：按 `root_id` 一次性拉取整棵树对中小规模 root 很高效；当单棵树数据量过大时，建议结合游标分页分段拉取，或继续采用“分页顶层 + 按需加载 children”。
- **外键启用**：SQLite 连接必须开启 `PRAGMA foreign_keys = ON`。
- **游标稳定性**：使用 `(created_at, id)` 作为排序与游标字段，避免同一时间戳下重复/漏读。
