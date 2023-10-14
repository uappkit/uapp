## 如何生成苹果手机登录授权时的 JWT Token

1、获取到 team_id, client_id, key_id 填入到 jwt/config.json 中，如下：

```.json
{
    "team_id": "3DSM494K6L",
    "client_id": "com.code0xff.uapp.login",
    "key_id": "3C7FMSZC8Z"
}
```

2、登录苹果开发者账号，创建并下载签名文件， 改名为jwt/key.txt。

3、运行 `uapp info` 命令查看 JWT Token

👉 参考教程: http://help.jwt.code0xff.com
