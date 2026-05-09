package service

import (
	"github.com/mojocn/base64Captcha"
)

// Captcha 登录用图形验证码（数字），答案存于内存 Store，进程重启即失效。
type Captcha struct {
	store  base64Captcha.Store
	driver *base64Captcha.DriverDigit
}

func NewCaptcha() *Captcha {
	return &Captcha{
		store:  base64Captcha.DefaultMemStore,
		driver: base64Captcha.NewDriverDigit(50, 120, 4, 0.45, 48),
	}
}

// Generate 返回 captcha_id 与可直接作为 <img src> 的 Data URL（image/png;base64,...）。
func (c *Captcha) Generate() (id, imageDataURL string, err error) {
	cap := base64Captcha.NewCaptcha(c.driver, c.store)
	id, b64s, _, err := cap.Generate()
	return id, b64s, err
}

// Verify 校验用户输入；clear 为 true 时在匹配成功后清除该 id（具体行为由 Store 实现决定）。
func (c *Captcha) Verify(id, answer string, clear bool) bool {
	if id == "" || answer == "" {
		return false
	}
	return c.store.Verify(id, answer, clear)
}
