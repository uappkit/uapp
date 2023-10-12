## uapp iOS 离线工程

iOS 的工程化一直都不太方便，通常都是用的 CocoaPods，但不适合 DCloud离线SDK 的发布形式。经过我们在产品中的不断实践，最终选择了 XCodeGen。

**工程目录结构**

```
.
├── Main
│   ├── App-Prefix.pch
│   ├── AppDelegate.h
│   ├── AppDelegate.m
│   ├── Pandora
│   ├── Resources
│   ├── ViewController.h
│   ├── ViewController.m
│   └── main.m
├── README.md
├── SDKs  # gitignore, 存放官方发布离线打包的SDK，或其他依赖的SDK, Libs等
├── config
├── manifest.json  # 指向 HBuilderX 工程里 manifest.json 的软连接
├── modules        # 存放第三方插件工程
│   └── README.md
├── out            # gitignore, `uapp run build:dev --sync` 生成打包基座，并同步给 HBuilderX
│   └── uapp_debug.xcarchive
├── project.yml
└── uapp.xcodeproj
```

### 下载 ios 离线工程源码

`git clone https://github.com/uappkit/uapp-ios.git`

### XcodeGen

xcodegen 是用来生成 xcode 工程文件的，使用 xcodegen 便于维护，自动化集成。

**通过 brew 安装**

`brew install xcodegen`

**通过 Make 安装**

```
git clone https://github.com/yonaskolb/XcodeGen.git
cd XcodeGen
make install
```

uapp 工程配置通过 [xcodegen](https://github.com/yonaskolb/XcodeGen) 来维护，配置文件结构如下：

```
.
├── project.yml # xcodegen 配置文件入口
└── config
   ├── base.yml # 基础配置，不建议修改
   ├── custom.yml # 自定义配置，可以添加修改
   ├── uapp_dev.yml # 用于 uapp-dev 开发阶段的配置
   └── uapp_release.yml # 用于 uapp-release 正式发布的配置
```

## 重点说明

第一次使用，或者修改 xcodegen 配置后，一定要执行:

`xcodegen`

会重新生成 xcode 的工程文件 `uapp.xcodeproj`

命令行可通过 `open uapp.xcodeproj` 打开 xcode 工程:

## 苹果登录 Sign In with Apple

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

详细教程可参考: <http://help.jwt.code0xff.com>

## 如何引入子工程

工程内包含其他子工程的，可以参照 IJKMediaPlayer 配置

projectReferences dependencies 官方用 target:

```.yaml
    - target: IJKMediaPlayer/IJKMediaFrameworkWithSSL
      embed: true
```

但这么用会出现一个 BUG, 当 targets 为多个时, 比如这里的 uapp-dev / uapp-release 两个时会出现 bug，修改 xcode 工程时会丢失这个引用。

看这里也有人反馈过，但貌似都没解决：<https://github.com/yonaskolb/XcodeGen/issues/933>

经过摸索, 可以通过配置 framework + `implicit: true` 解决, 如下:

```.yaml
    - framework: IJKMediaFrameworkWithSSL.framework
      implicit: true
      embed: true
```
