## uapp

uapp 让uniapp离线打包更简单高效。

uniapp是一个基于Vue同构技术的多平台前端框架，对公司或创业者来说，只需要有一个会Vue的前端，就可以同时写App(android/ios)，H5，快应用，微信/QQ/抖音/飞书/百度/支付宝等各家小程序，维护一套代码可以发布10多个平台。有以下几大好处：

* 发布多个平台获取更多流量
* 一旦熟悉，开发效率极高
* 至少省 1 / 3 研发成本，商业试错成本更低
* 即使当前不需要发布多平台，同样花时间写代码，为什么不选择复用价值更高的方法呢

但 uniapp 官方发布的离线包里只有 DEMO，对于一个新的项目，需要手动更改的配置较多，且调试基座和正式发版共用一个配置，维护起来也很不方便。uapp 就是我们在实践了一些产品后，积累的一些经验，分离了调试和发布的配置，也方便通过命令加入自动化集成。

**为什么不使用在线打包呢?**

uniapp 在线打包，一般无法满足灵活的需求，比如：

* 没法在团队里实施自动化集成（自动构建、单元测试、发布）。
* 有些包是冗余的，在线打包不能控制具体打入哪些包。
* 在线打包有大小限制，超过需要单独付费，因为特别占用官方服务器资源。
* 写uniapp插件扩展时，必须有离线工程才方便调试，且可以自己控制是否发布插件。我们也是在写 ffmpeg 扩展时，遇到些许不便。

## 先安装 uappsdk

1、 安装 uapp 命令

```
npm install -g @uappkit/cli

# 初始化或更新 uappsdk
uapp sdk init
```

2、下载 uniapp 离线打包的 SDK

> 注意和.uappsdk区分开，此处的uniapp离线包的SDK是指dcloud 官方发布的

**android 离线打包SDK:**

<https://nativesupport.dcloud.net.cn/AppDocs/download/android>

**ios 离线打包SDK:**

<https://nativesupport.dcloud.net.cn/AppDocs/download/ios>

解压其中的SDK目录，放入 .uappsdk 文件夹里，最终 .uappsdk 文件夹结构如下:

```
> $HOME/.uappsdk/
.
├── android
│   ├── SDK # -> 这里是Android的SDK
│   └── libs
├── ios
│   ├── SDK # -> 这里是iOS的SDK
└── templates
    └── manifest.json
```

> SDK 相关文件都放在当前用户的 $HOME/.uappsdk 目录下。

需要引入哪些模板，请务必仔细阅读官方的 SDK 模块依赖说明，包含多了会影响APP审核，少了会影响功能使用。

.uappsdk 目录下默认包含的第三方依赖包，仅含有微信授权登录，苹果授权登录，基础功能等。不包含广告、通知等相关依赖，因为广告和通知类的sdk，在审核时需要特别提交数据跟踪说明，比较麻烦。

如不是必须，最好不包含。如果确实需要，可以自行手动添加，参照如下模块依赖说明。

**android 模块依赖说明:**

针对 android，仅需提取必用的依赖包放入 $HOME/.uappsdk/android/libs 里。
<https://nativesupport.dcloud.net.cn/AppDocs/usemodule/androidModuleConfig/android_Library>

**ios 模块依赖说明:**

<https://nativesupport.dcloud.net.cn/AppDocs/usemodule/iOSModuleConfig/common>

## 下载离线打包工程模板

### 1. 下载 android 离线工程模板

`git clone https://github.com/uappkit/uapp-android.git`

### 2. 下载 ios 离线工程模板

`git clone https://github.com/uappkit/uapp-ios.git`

### 3. 工程下常见命令

```
# 读取 manifest 中的配置，并更新基本信息
uapp manifest {uni-app 工程目录}/src/manifest.json
uapp manifest

# 更新 HBuilderX 本地打包资源
# 如果通过 HBuilderX 重新编译，或者通过 uniapp-cli 命令重新编译的资源，可以通过 prepare 命令更新到离线 APP 工程中，用于 APP 重新打包发布。
uapp prepare

# 发布离线打包基座到 HBuilderX 下
uapp publish debug
```

## manifest.json 相关配置

> 注意: `参数package, dcloud_appkey` 是 uapp 根据需要扩展出来的。

原工程里的 `manifest.json` 内的参数，大多是给 hbuiderx 在线云打包用的。编译后生成的终极发布包，里面的 manifest.json 已被去除了无关数据，所以不用担心参数暴露问题。

```.json
{
  "name": "uapp",
  "appid": "__UNI__ECA8F4D",
  "description": "made by uapp",
  "versionName": "1.0.1",
  "versionCode": "1000000",
  "uapp": {
    /* name, package, versionName, versionCode 如果需要平台差异化定义, 可以加前缀 android.xxx, ios.xxx */
    /* 例如 android.name, android.package, ios.package, ios.versionCode ... */
    "name": "μAppKit",
    "package": "com.code0xff.uapp",
    "android.appkey": "b4ab7d1c668cbb3b257aeeabd75c29da",
    "ios.appkey": "aa215ff1522abe39cb7ccec5943eeb92"
  },
  "app-plus": {
    "distribute": {
      "sdkConfigs": {
        "oauth": {
          "weixin": {
            "appid": "wx95039516c9f72e50",
            "appsecret": "123456",
            "UniversalLinks": "https://uapp.code0xff.com/"
          }
        }
      }
    }
  }
}
```

**如何申请 dcloud_appkey**

<https://nativesupport.dcloud.net.cn/AppDocs/usesdk/appkey>

**如何申请微信 appid**

登录微信开发者平台创建APP，审核过后，获取 `weixin.appid, weixin.appsecret` 等参数，用于微信登录，分享，支付等相关参数

<https://open.weixin.qq.com/>

## 跨端开发注意事项

<https://uniapp.dcloud.io/matter.html>

## uapp 使用帮助

见 [doc/help.txt](doc/help.txt)

## 技术问题加群

  遇到技术问题，可加微信入群交流

  微信：yinqisen

  Email: v@yinqisen.cn
