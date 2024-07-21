### 使用方法

`uapp privacy`

需要自定义内容条款时，可以在当前目录放两个模版文件，当前目录下的模版会被优先搜索使用，如果没有会使用`uapp`自带的模版。

`reg.tpl.md` 对应《用户注册条款》

`privacy.tpl.md` 对应《隐私协议条款》

### 使用 vitepress 生成静态页

vitepress 使用参考：  
<https://vitepress.dev/zh/guide/what-is-vitepress>

.vitepress/config.js 配置参考

```javascript
export default {
  title: 'uapp.dev',
  lang: 'zh-CN',
  titleTemplate: false,
  themeConfig: {
    siteTitle: false,
    footer: {
      message: '',
      copyright: `Copyright © ${new Date().getFullYear()} <a href='https://www.code0xff.com/'>uapp.dev</a>`,
    },
    docFooter: {
      prev: '上一页',
      next: '下一页',
    },

    outline: {
      label: '页面导航',
    },

    lastUpdated: {
      text: '最后更新于',
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'medium',
      },
    },

    langMenuLabel: '多语言',
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
  },
}
```

### 替换了哪些参数

`uapp privacy` 会根据命令提示内容自行替换。下方参数仅作了解，方便知道命令里替换了哪些参数。

```json5
{
  // 替换为公司名全称
  "$COMPANY_FULL$": "沈阳匠心软件有限公司",
  // 替换为公司名简称
  "$COMPANY_SHORT$": "匠心软件",
  // 替换为 APP 名字
  "$APPNAME$": "μAppKit",
  // 在隐私协议末尾留的联系信息，写明电话还是邮箱
  //"$CONTACT_US$": "电话 13011119999"
  "$CONTACT_US$": "邮箱: open@code0xff.com"
}
```
