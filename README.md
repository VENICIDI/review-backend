# Review Backend

## 项目简介

这是一个基于 **NestJS + TypeORM + SQLite** 的后端服务，用于演示/实现「文章无限层级评论」的常见能力：

- **顶层评论**：对文章发表评论
- **无限层级回复**：评论可以回复评论
- **分页加载**：顶层评论/子评论支持游标分页
- **整棵子树**：可一次性获取某条评论的完整子树（谨慎使用）
- **软删除**：删除评论不会破坏子树结构，被删评论返回占位内容

默认启动端口为 `3000`，数据库为项目根目录下的 `db.sqlite`（可通过环境变量修改）。

## 技术栈

- **框架**：NestJS
- **ORM**：TypeORM
- **数据库**：SQLite
- **测试**：Jest

## 快速开始

### 1) 安装依赖

```bash
npm i
```

### 2) 启动服务

开发模式（推荐）：

```bash
npm run start
```

服务启动后：

- `GET http://localhost:3000/` 返回 `Hello World!`

## 配置

- **`PORT`**：服务监听端口（默认 `3000`）
- **`DB_PATH`**：SQLite 文件路径（默认 `db.sqlite`）

示例：

```bash
PORT=3001 DB_PATH=./tmp/dev.sqlite npm run start:dev
```

## 数据库说明

- **数据库**：SQLite（文件模式）
- **建表方式**：TypeORM `synchronize: true`（开发便利，启动时自动同步表结构）
- **外键**：启动时执行 `PRAGMA foreign_keys = ON;`

表结构与设计取舍详见 `DESIGN.md`。

重置数据库（本地开发）：

- 直接删除 `db.sqlite` 后重新启动服务即可自动重建

```bash
curl -i -X DELETE 'http://localhost:3000/comments/1'
```

## 目录结构

```text
src/
  comments/                 评论领域模块（controller/service/dto）
  common/                   通用能力（interceptors/middleware 等）
  entities/                 TypeORM 实体（articles/comments）
  app.module.ts             应用模块与 TypeORM/SQLite 配置
  main.ts                   应用启动入口
test/                       e2e 测试
db.sqlite                   默认 SQLite 文件
DESIGN.md                   系统设计与表结构说明
```

## 相关文档

- `DESIGN.md`：评论树模型、索引、分页策略与关键实现细节

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

### 2.1 分页获取文章的顶层评论（首屏预览：每条带最多 2 条子评论）

- **GET** `/articles/:articleId/comments/preview`
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
      "updatedAt": "2025-12-24T07:00:00Z",
      "children": [
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
      ]
    }
  ],
  "nextCursor": "..."
}
```

- **说明**
  - 仅返回顶层评论（`parentId = null`）
  - 仅返回未删除评论（`isDeleted = 0`）
  - `children` 为每条顶层评论的直接子评论预览，最多返回 2 条
  - `children` 的排序与截断规则会跟随 `order` 参数：
    - `order=desc`：返回最新的 2 条子评论
    - `order=asc`：返回最早的 2 条子评论
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

### 6. 获取某条评论的完整子树（一次拉取）

- **GET** `/comments/:commentId/tree`
- **Response 200**

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
    "updatedAt": "2025-12-24T07:00:00Z",
    "children": [
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
        "updatedAt": "2025-12-24T07:01:00Z",
        "children": []
      }
    ]
  }
}
```

- **说明**
  - 返回以 `:commentId` 为根的子树（包含该评论本身）
  - 子树节点按 `createdAt ASC, id ASC` 构建
  - 已删除评论会返回 `content = 该评论已删除`
- **可能错误**
  - `404`：评论不存在（`comment not found`）

### 7. 软删除评论

- **DELETE** `/comments/:commentId`
- **Response 204**（无 body）
- **可能错误**
  - `404`：评论不存在（`comment not found`）
