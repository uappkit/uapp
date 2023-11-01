![uapp.dev](https://mixcut.b0.v56.fun/uapp/uapp.dev.png)

## 了解 uapp 跨平台开发工具箱

```js
// what's uapp
const uapp = 'universal app'
```

uapp 是一款跨平台APP开发工具箱，所有积累都来自多年产品开发中的不断实践。开发者仅需写一套代码，就能横扫所有平台。

uapp 支持所有的手机端(android, ios)，支持所有的电脑端(windows, mac osx, linux)，支持所有的小程序(
微信/抖音/百度/QQ/飞书/钉钉/快应用等等)，也能支持所有的浏览器插件开发。

多一个平台，就多了一个流量渠道，多一个平台，就多个一个用户选择的理由。传统的开发形式，不同平台需要不同的开发者经验，uapp 通过集成
uniapp，electron，tauri，只需要开发者有Web H5的开发经验，就能搞定所有平台。哪怕只开发一个平台，同样花时间写代码，为什么不选择复用价值更高的方法呢。

如以下知名产品都采用了和uapp一样的跨平台方案：

- [x] 微信电脑客户端
- [x] 新版QQ桌面版
- [x] 抖音电脑客户端
- [x] 钉钉客户端
- [x] Visual Studio Code
- [x] Xmind 思维导图
- [x] 微信开发者工具
- [x] WhatsApp

有人认为 uapp 这种跨平台方案，只是为了节省研发费用，但我相信上面这些大公司，都并不缺少研发费用，为什么还要选择 uapp
这种跨平台方案呢？如果有一种方案能让自己的产品极快的满足业务变化，紧跟市场需求，第一时间得到市场验证反馈，第一时间抓住商业机会，那么这些价值会远大于节省下来的研发费用。雷军雷总说过试错的成本并不高，但错过的成本非常高。

---

**Android Build**

![android build](https://mixcut.b0.v56.fun/uapp/android_build.gif)

**iOS Build**

![ios build](https://mixcut.b0.v56.fun/uapp/ios_build.gif)

## 一、先安装 uappsdk

1、 安装 uapp 命令

```
npm install -g uapp

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

针对 android，将依赖的包名放入工程目录 `app/sdk.libs` 文件内，每个包名一行。
<https://nativesupport.dcloud.net.cn/AppDocs/usemodule/androidModuleConfig/android_Library>

**ios 模块依赖说明:**

<https://nativesupport.dcloud.net.cn/AppDocs/usemodule/iOSModuleConfig/common>

## 二、Vue 工程 (重点看) 🔥

Vue 工程，有两种创建方法：

第一种：通过 `uapp new` (等同于 uniapp-cli) 命令创建

```bash
# 不带参数，默认使用 vue3 & vite 模版
uapp new DemoProject

# 支持参数
uapp new DemoProject --alpha --typescript
uapp new DemoProject --vue2 # 旧的 vue2 模版
```

第二种，通过 HBuilderX 菜单里新建工程，和第一种cli创建的区别是，HBuilderX 创建不带 package.json 和 src 目录，等同于直接就是
src 目录里的内容。

**创建好 Vue 工程后，一定要参照下面流程，获取 appid，和添加 uapp 节点。**

☘️ HBuilderX 打开工程，再选中 manifest.json 配置

- (必须) 基础配置 => 确定获取到 appid
- (必须) 源码视图 => versionCode 下面添加 uapp 节点，内容如下：

```json5
{
  // ...
  "versionCode": "100",
  "uapp": {
    "name": "μAppKit",
    "package": "com.code0xff.uapp",
    "android.appkey": "申请并替换为 android dcloudkey",
    "ios.appkey": "申请并替换为 ios dcloudkey"
  },
  // ...
}
```

- (建议) App图标配置 => 浏览选择图标文件 => 自动生成

- (建议) App模块配置 => OAuth 登录鉴权 => (微信登录, iOS Universal Links)

> 👉 `dcloudkey` 后台申请的链接，和要填写的内容，可通过 `uapp info` 命令查看，非常方便。

## 三、离线打包工程

### 1. 新建 android 工程

`uapp add android`

### 2. 新建 ios 工程

`uapp add ios`

> 如果当前目录已有 android 或 ios 目录，会提示错误，可将其改名后，再执行命令

iOS 的工程化一直都不太方便，通常都是用的 CocoaPods，但不适合 DCloud离线SDK 的发布形式。经过我们在产品中的不断实践，最终选择了
XCodeGen。

### 3. 离线工程下常见命令

```
# 读取 manifest 中的配置，并更新基本信息
uapp manifest path/to/manifest.json

# 查看 dcloudkey 和对接第三方平台需要的信息
uapp info

# 更新 HBuilderX 生成的App图标和本地打包资源
uapp prepare

# 编译APP安装包, 并发布自定义基座到 HBuilderX 下
uapp run build:dev

# 仅编译APP安装包，但不编译 webapp
uapp run build:dev --no-webapp

# 仅编译APP安装包，但不执行 prepare 更新资源
uapp run build:dev --no-webapp

# 仅编译APP安装包，但不发布自定义基座到 HBuidlerX 下
uapp run build:dev --no-copy

# 编译 android release apk
uapp run build

# 运行自定义打包发布流程，配置见 manifest.json => custom.command
uapp run custom
```

## 四、manifest.json 相关配置

> 注意: `uapp.* 参数` 是 uapp 根据需要扩展出来的, 非 dcloud 官方标准.

原工程里的 `manifest.json` 内的参数，大多是给 hbuiderx 在线云打包用的。编译后生成的终极发布包，里面的 manifest.json
已被去除了无关数据，所以不用担心参数暴露问题。

```.json
{
  "name": "uapp",
  "appid": "__UNI__ECA8F4D",
  "versionName": "1.0.1",
  "versionCode": "1000000",
  "uapp": {
    "name": "μAppKit",
    "package": "com.code0xff.uapp",
    "android.appkey": "b4ab7d1c668cbb3b257aeeabd75c29da",
    "ios.appkey": "aa215ff1522abe39cb7ccec5943eeb92",
    "custom.command": "cd ${SRC}/../ && npm run build:app && cd - && uapp prepare && uapp run build:dev"
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

### 🔥 uapp.* 参数说明

👉 不同平台可以用前缀区分

<blockquote>
name, package, versionName, versionCode 如果需要平台差异化定义, 可以加前缀 android.*, ios.*

例如 android.name, android.package, ios.package, ios.versionCode ...

custom.command 参数内，可以使用 `${SRC}, ${SRC}` 为当前 manifest.json 的同级目录，支持加 ../定位上一级目录，避免用绝对路径。
</blockquote>

👇👇 👇

| uapp.* 参数      | 说明                                                                                                   |
|:---------------|------------------------------------------------------------------------------------------------------|
| name           | APP名字，不填写默认使用根节点的name。不同平台可以加前缀区分，如 android.name                                                     |
| package        | 应用的包名。不同平台可以加前缀区分，如 ios.package                                                                      |
| android.appkey | DCloud平台申请的，Android 平台 dcloud_appkey，下方有申请地址                                                         |
| ios.appkey     | DCloud平台申请的，iOS 平台 dcloud_appkey，下方有申请地址                                                             |
| versionName    | App版本名，同上可以加前缀区分不同平台。如 android.versionName                                                           |
| versionCode    | App版本Code，同上可以加前缀区分不同平台。如 ios.versionCode                                                            |
| custom.command | (选填) uapp run custom 执行的自定义命令。比如一条命令里做很多事: `npm run build:app && uapp prepare && uapp run build:dev` |

## 五、其他参考

### iOS 苹果授权登录

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

👉 参考教程: <http://help.jwt.code0xff.com>

### 如何申请 dcloud_appkey

<https://nativesupport.dcloud.net.cn/AppDocs/usesdk/appkey>

### 如何申请微信 appid

登录微信开发者平台创建APP，审核过后，获取 `weixin.appid, weixin.appsecret` 等参数，用于微信登录，分享，支付等相关参数

<https://open.weixin.qq.com/>

### 跨端开发注意事项

<https://uniapp.dcloud.io/matter.html>

---

## uapp 使用帮助

见 [doc/help.txt](doc/help.txt)

## License

The Apache License 2. Please see [License File](LICENSE.md) for more information.

## 联系我

如果你在使用 uapp 中，遇到问题，或有改进建议，欢迎联系

+vx: `yinqisen`
