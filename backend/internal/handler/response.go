package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Response 标准响应结构
type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// OK 返回成功响应，code=0
func OK(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{Code: 0, Message: "success", Data: data})
}

// OKMsg 返回带自定义消息的成功响应
func OKMsg(c *gin.Context, msg string, data interface{}) {
	c.JSON(http.StatusOK, Response{Code: 0, Message: msg, Data: data})
}

// Fail 返回失败响应
func Fail(c *gin.Context, httpCode int, msg string) {
	c.JSON(httpCode, Response{Code: -1, Message: msg})
}

// BindFail 返回参数绑定失败响应
func BindFail(c *gin.Context, err error) {
	c.JSON(http.StatusBadRequest, Response{Code: -1, Message: "参数错误: " + err.Error()})
}
