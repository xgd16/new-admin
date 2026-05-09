package response

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"new-admin/pkg/errcode"
)

type Body struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func JSON(c *gin.Context, httpStatus int, code int, msg string, data interface{}) {
	if data == nil {
		data = struct{}{}
	}
	c.JSON(httpStatus, Body{
		Code:    code,
		Message: msg,
		Data:    data,
	})
}

func OK(c *gin.Context, data interface{}) {
	JSON(c, http.StatusOK, errcode.OK, "ok", data)
}

func Fail(c *gin.Context, httpStatus int, code int, msg string) {
	JSON(c, httpStatus, code, msg, struct{}{})
}
