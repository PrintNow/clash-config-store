---
name: add-api-endpoint
description: 在 Clash Config Store 后端新增一个完整的 API 端点，包括 GORM 模型（如需）、service 业务逻辑、handler 处理器和路由注册。当用户要求新增后端接口、新资源、或扩展现有 CRUD 时使用。
---

# 新增后端 API 端点

## 步骤清单

- [ ] 1. 确定资源名称和字段
- [ ] 2. （如需）在 `internal/model/` 新增 GORM 模型
- [ ] 3. 在 `internal/service/` 实现业务逻辑
- [ ] 4. 在 `internal/handler/` 实现 HTTP 处理器
- [ ] 5. 在 `cmd/server/main.go` 注册路由

---

## 1. 模型（`internal/model/foo.go`）

```go
package model

type Foo struct {
    Base
    UserID uint   `gorm:"not null;index" json:"user_id"`
    Name   string `gorm:"not null" json:"name"`
    // ... 其他字段

    User User `gorm:"foreignKey:UserID" json:"-"`
}
```

然后在 `repository/db.go` 的 `autoMigrate()` 中添加 `&model.Foo{}`。

---

## 2. Service（`internal/service/foo.go`）

```go
package service

import (
    "clash-config-store/internal/model"
    "clash-config-store/internal/repository"
)

func ListFoos(userID uint) ([]model.Foo, error) {
    var foos []model.Foo
    err := repository.DB.Where("user_id = ?", userID).Find(&foos).Error
    return foos, err
}

func CreateFoo(userID uint, name string) (*model.Foo, error) {
    foo := &model.Foo{UserID: userID, Name: name}
    return foo, repository.DB.Create(foo).Error
}

func UpdateFoo(id, userID uint, name string) (*model.Foo, error) {
    var foo model.Foo
    if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&foo).Error; err != nil {
        return nil, err
    }
    repository.DB.Model(&foo).Update("name", name)
    return &foo, nil
}

func DeleteFoo(id, userID uint) error {
    return repository.DB.Where("id = ? AND user_id = ?", id, userID).Delete(&model.Foo{}).Error
}
```

---

## 3. Handler（`internal/handler/foo.go`）

```go
package handler

import (
    "net/http"
    "strconv"

    "clash-config-store/internal/middleware"
    "clash-config-store/internal/service"

    "github.com/gin-gonic/gin"
)

func ListFoos(c *gin.Context) {
    userID := middleware.CurrentUserID(c)
    foos, err := service.ListFoos(userID)
    if err != nil {
        Fail(c, http.StatusInternalServerError, err.Error())
        return
    }
    OK(c, foos)
}

func CreateFoo(c *gin.Context) {
    var req struct {
        Name string `json:"name" binding:"required"`
    }
    if err := c.ShouldBindJSON(&req); err != nil {
        BindFail(c, err)
        return
    }
    userID := middleware.CurrentUserID(c)
    foo, err := service.CreateFoo(userID, req.Name)
    if err != nil {
        Fail(c, http.StatusInternalServerError, err.Error())
        return
    }
    OK(c, foo)
}

func UpdateFoo(c *gin.Context) {
    id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
    var req struct {
        Name string `json:"name" binding:"required"`
    }
    if err := c.ShouldBindJSON(&req); err != nil {
        BindFail(c, err)
        return
    }
    userID := middleware.CurrentUserID(c)
    foo, err := service.UpdateFoo(uint(id), userID, req.Name)
    if err != nil {
        Fail(c, http.StatusNotFound, "资源不存在")
        return
    }
    OK(c, foo)
}

func DeleteFoo(c *gin.Context) {
    id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
    userID := middleware.CurrentUserID(c)
    if err := service.DeleteFoo(uint(id), userID); err != nil {
        Fail(c, http.StatusInternalServerError, err.Error())
        return
    }
    OK(c, nil)
}
```

---

## 4. 注册路由（`cmd/server/main.go`）

在 `protected` 路由组中添加：

```go
foo := protected.Group("/foos")
foo.GET("", handler.ListFoos)
foo.POST("", handler.CreateFoo)
foo.PUT("/:id", handler.UpdateFoo)
foo.DELETE("/:id", handler.DeleteFoo)
```

---

## 关键要点

- **所有权验证**：`WHERE id = ? AND user_id = ?`，防止越权
- **响应格式**：统一使用 `handler.OK` / `handler.Fail`
- **用户 ID**：从 `middleware.CurrentUserID(c)` 获取，不信任请求体中的 user_id
