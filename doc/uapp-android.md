## uapp android 离线工程

```
.
├── README.md
└── app
    ├── app.keystore # 用于 apk 安装包签名
    ├── build.gradle # 基础配置, uapp manifest 会更新相关信息
    ├── custom.gradle # 自定义相关配置, 新增第三方依赖等
    ├── libs -> # 指向uappsdk 下的相关软连接, 此目录下的 libs 都会打包进 apk, 根据自身需要做调整
    └── src
```

### 下载 android 离线工程模板

`git clone https://github.com/uappkit/uapp-android.git`
