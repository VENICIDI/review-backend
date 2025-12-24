# Review Backend

## 已实现接口（以代码为准）

### 1. 健康检查

- **GET** `/`
- **Response 200**

```text
Hello World!
```

### 2. 分页获取文章的顶层评论

- **GET** `/articles/:articleId/comments`
- **Query**
  - `limit`：可选，默认 `20`，服务端会 clamp 到 `1..100`
  - `order`：可选，`asc|desc`，默认 `desc`
  - `cursor`：可选，`base64url(JSON)`，JSON 结构为：`{"createdAt":"...","id":123}`
- **Response 200**

```json
{
  "items": [
    {
      "id": 1,
      "articleId": 1,
      "rootId": 1,
      "parentId": null,
      "depth": 0,
      "authorId": 9,
      "content": "hello",
      "status": 1,
      "isDeleted": 0,
      "createdAt": "2025-12-24T07:00:00Z",
      "updatedAt": "2025-12-24T07:00:00Z"
    }
  ],
  "nextCursor": "..."
}
```

- **说明**
  - 仅返回顶层评论（`parentId = null`）
  - 仅返回未删除评论（`isDeleted = 0`）
- **可能错误**
  - `400`：`limit` 非数字 / `order` 非 `asc|desc` / `cursor` 非法
  - `404`：文章不存在（`article not found`）

### 3. 对文章发表评论（顶层）

- **POST** `/articles/:articleId/comments`
- **Body**

```json
{
  "content": "hello",
  "authorId": 9
}
```

- **Response 201**

```json
{
  "comment": {
    "id": 1,
    "articleId": 1,
    "rootId": 1,
    "parentId": null,
    "depth": 0,
    "authorId": 9,
    "content": "hello",
    "status": 1,
    "isDeleted": 0,
    "createdAt": "2025-12-24T07:00:00Z",
    "updatedAt": "2025-12-24T07:00:00Z"
  }
}
```

- **可能错误**
  - `400`：`content` 为空（`content is required`）/ `authorId` 非 number
  - `404`：文章不存在（`article not found`）

### 4. 回复某条评论

- **POST** `/comments/:commentId/replies`
- **Body**

```json
{
  "content": "reply",
  "authorId": 9
}
```

- **Response 201**

```json
{
  "comment": {
    "id": 2,
    "articleId": 1,
    "rootId": 1,
    "parentId": 1,
    "depth": 1,
    "authorId": 9,
    "content": "reply",
    "status": 1,
    "isDeleted": 0,
    "createdAt": "2025-12-24T07:01:00Z",
    "updatedAt": "2025-12-24T07:01:00Z"
  }
}
```

- **可能错误**
  - `400`：`content` 为空（`content is required`）/ `authorId` 非 number
  - `400`：父评论已删除（`cannot reply to deleted comment`）
  - `404`：父评论不存在（`comment not found`）

### 5. 分页获取某条评论的直接子评论

- **GET** `/comments/:commentId/children`
- **Query**
  - `limit`：可选，默认 `20`，服务端会 clamp 到 `1..100`
  - `order`：可选，`asc|desc`，默认 `desc`
  - `cursor`：可选，`base64url(JSON)`，JSON 结构为：`{"createdAt":"...","id":123}`
- **Response 200**

```json
{
  "items": [
    {
      "id": 2,
      "articleId": 1,
      "rootId": 1,
      "parentId": 1,
      "depth": 1,
      "authorId": 9,
      "content": "reply",
      "status": 1,
      "isDeleted": 0,
      "createdAt": "2025-12-24T07:01:00Z",
      "updatedAt": "2025-12-24T07:01:00Z"
    }
  ],
  "nextCursor": "..."
}
```

- **说明**
  - 仅返回直接子评论（`parentId = :commentId`）
  - 仅返回未删除评论（`isDeleted = 0`）
- **可能错误**
  - `400`：`limit` 非数字 / `order` 非 `asc|desc` / `cursor` 非法
  - `404`：父评论不存在（`comment not found`）

### 6. 软删除评论

- **DELETE** `/comments/:commentId`
- **Response 204**（无 body）
- **可能错误**
  - `404`：评论不存在（`comment not found`）

## DESIGN.md 规划但尚未实现的接口

- **GET** `/comments/:commentId/tree`（获取某条评论的完整子树，一次拉取）

## 代码入口

- `src/comments/comments.controller.ts`
- `src/comments/comments.service.ts`
- `src/comments/comments.repository.ts`
- `test/app.e2e-spec.ts`