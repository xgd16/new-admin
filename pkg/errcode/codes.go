package errcode

// 业务错误码约定：HTTP 状态仍以 REST 语义为准；业务 code 与 HTTP 解耦便于前端统一处理。

const (
	OK = 0

	// 客户端错误 4xxxx
	BadRequest   = 40001
	Unauthorized = 40101
	Forbidden    = 40301
	NotFound     = 40401

	// 服务端错误 5xxxx
	InternalError = 50001
)
