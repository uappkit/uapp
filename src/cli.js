/**
 * Author: Yin Qisen <yinqisen@gmail.com>
 * Github: https://github.com/uappkit
 *
 * Copyright(c) 2022 - 2023, uapp.dev
 */

const _ = require('lodash');
const nopt = require('nopt');
const updateNotifier = require('update-notifier');
const fs = require('fs');
const ora = require('ora');

const path = require('path');
const { execSync, spawnSync, spawn } = require('child_process');
const tiged = require('tiged');
const chalk = require('chalk');
const pkg = require('../package.json');
const sync = require('./sync');
const stripJsonComments = require('./stripJsonComments');
const { emptyDirSync, removeSync, pathExistsSync } = require('fs-extra');

const knownOpts = {
  version: Boolean,
  help: Boolean,
  typescript: Boolean,
  alpha: Boolean,
  vue2: Boolean,
  copy: Boolean,
  open: Boolean,
  webapp: Boolean,
  prepare: Boolean,
  out: path
};

const shortHands = {
  o: '--out',
  v: '--version',
  h: '--help'
};

let $G = {
  args: {},
  appDir: process.cwd(),
  sdkHomeDir: path.join(require('os').homedir(), '.uappsdk'),
  localLinkManifest: path.join(process.cwd(), 'manifest.json'),
  manifest: {},
  webAppDir: '',
  projectType: 'unknown',
  config: {}
};

module.exports = function (inputArgs) {
  checkForUpdates();
  let args = $G.args = nopt(knownOpts, shortHands, inputArgs);

  if (args.version) {
    console.log('uapp 当前版本: ' + pkg.version);
    return;
  }

  if (args.copy === undefined) {
    args.copy = true;
  }

  if (args.webapp === undefined) {
    args.webapp = true;
  }

  if (args.prepare === undefined) {
    args.prepare = true;
  }

  // command: uapp help
  const cmd = args.argv.remain[0] || 'help';
  if (!cmd || cmd === 'help' || args.help) {
    printHelp();
    return;
  }

  let configFile = path.join($G.sdkHomeDir, 'config.json');
  if (fs.existsSync(configFile)) {
    $G.config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
  }

  if (!$G.config['hbx.dir'] && process.platform === 'darwin') {
    $G.config['hbx.dir'] = '/Applications/HBuilderX.app';
  }

  if (!$G.config['wx.dir']) {
    if (process.platform === 'darwin') {
      let settingFile = path.join(require('os').homedir(), 'Library/Application Support/HBuilder X/user/settings.json');
      if (fs.existsSync(settingFile)) {
        $G.config['wx.dir'] = require(settingFile)['weApp.devTools.path'];
      }

      if (!$G['wx.dir']) {
        $G.config['wx.dir'] = '/Applications/wechatwebdevtools.app';
      }
    } else if (process.platform === 'win32') {
      let settingFile = path.join(require('os').homedir(), 'AppData/Roaming/HBuilder X/user/settings.json');
      if (fs.existsSync(settingFile)) {
        $G.config['wx.dir'] = require(settingFile)['weApp.devTools.path'];
      }

      if (!$G.config['wx.dir']) {
        $G.config['wx.dir'] = 'C:\\Program Files (x86)\\Tencent\\微信web开发者工具';
      }
    }
  }

  if (cmd === 'config') {
    if (args.argv.remain[1] && args.argv.remain[1].includes('=')) {
      return console.log(chalk.yellow('参数不支持 = , 请使用空格间隔参数'));
    }

    $G.config[args.argv.remain[1]] = args.argv.remain[2];
    if (args.argv.remain[2] === undefined) {
      console.log(chalk.yellow(`已移除参数 ${args.argv.remain[1]}`));
    } else {
      console.log(chalk.green(`已配置参数 ${args.argv.remain[1]}: ${args.argv.remain[2]}`));
    }

    return fs.writeFileSync(path.join($G.sdkHomeDir, 'config.json'), JSON.stringify($G.config, null, 2));
  }

  if (cmd === 'hbx') {
    return runHBuilderXCli(args.argv.original.slice(1));
  }

  if (cmd === 'wx') {
    return runWeixinCli(args.argv.original.slice(1));
  }

  // 如果当面目录不存在 manifest.json，尝试使用 ../src/manifest.json
  if (!fs.existsSync($G.localLinkManifest)) {
    let tryManifestFile = path.resolve(path.join($G.appDir, '../src/manifest.json'));
    if (fs.existsSync(tryManifestFile)) {
      $G.localLinkManifest = tryManifestFile;
    }
  }

  if (fs.existsSync(path.join($G.appDir, 'Main/AppDelegate.m'))) {
    $G.projectType = 'ios';
  } else if (fs.existsSync(path.join($G.appDir, '/app/build.gradle'))) {
    $G.projectType = 'android';
  } else if (fs.existsSync(path.join($G.appDir, 'pages.json')) && pathExistsSync(path.join($G.appDir, 'pages'))) {
    $G.projectType = 'webapp';
  } else if (
    fs.existsSync(path.join($G.appDir, '/src/pages.json')) &&
    pathExistsSync(path.join($G.appDir, '/src/pages'))
  ) {
    $G.projectType = 'webapp';
    $G.localLinkManifest = path.join(process.cwd(), 'src/manifest.json');
  }

  // command: uapp new
  if (cmd === 'new') {
    let projectName = args.argv.remain[1];
    if (!projectName) {
      return console.log('缺少参数名，例如: uapp new project1');
    }

    if (args.vue2) {
      // vue2 必须使用小写
      let baseCommand = args.alpha
        ? 'vue create -p dcloudio/uni-preset-vue#alpha '
        : 'vue create -p dcloudio/uni-preset-vue ';
      try {
        execSync(baseCommand + projectName.toLowerCase(), { stdio: 'inherit' });
      } catch (error) {
        console.log('请先安装 vue 环境:');
        console.log('npm i -g @vue/cli');
      }
    } else {
      let branch = args.alpha ? '#vite-alpha' : '#vite';
      if (args.typescript) {
        branch = '#vite-ts';
      }

      clone(`https://gitee.com/dcloud/uni-preset-vue.git${branch}`, projectName);
    }
    return;
  }

  // command: uapp sdk init
  if (cmd === 'sdk' && args.argv.remain[1] === 'init') {
    sync(path.resolve(__dirname, '../uappsdk'), $G.sdkHomeDir, { delete: false });
    console.log(chalk.green('--- uappsdk 已安装 ---'));
    return;
  }

  // command: uapp add ${platform}
  // support platforms: android, ios
  if (cmd === 'add') {
    let platform = args.argv.remain[1];
    let supportPlatform = ['android', 'ios'];
    if (!supportPlatform.includes(platform)) {
      console.log(`不支持平台 ${platform}, 当前支持的平台有: ${supportPlatform.join(', ')}`);
      return;
    }

    return clone(`https://gitee.com/uappkit/platform.git/${platform}#main`, platform);
  }

  /*
  |--------------------------------------------------------------------------
  | 命令分水岭
  | * 上面命令不需要限制项目目录下
  | * 下面命令需要限制在项目下运行
  |--------------------------------------------------------------------------
  */

  if ($G.projectType === 'unknown') {
    console.log('无法确定项目类型，请在支持的项目中运行命令');
    console.log('目前支持的项目类型有: webapp, android, ios');
    return;
  }

  if ($G.projectType === 'webapp' && cmd !== 'run') {
    return console.log('webapp 不支持命令 uapp ' + cmd);
  }

  // command: uapp keygen
  if (cmd === 'keygen') {
    if ($G.projectType === 'android') {
      console.log('注意: ');
      console.log('build.gradle 中密码默认为 123456, 如有修改为其他密码，请对应修改 build.gradle 中的配置');
    }
    console.log('需要输入两次6位密码, 例如输入密码: 123456\n');

    let keyFile = path.join($G.appDir, 'app/app.keystore');
    fs.mkdirSync(path.dirname(keyFile), { recursive: true });

    try {
      let keyCommand =
        'keytool -genkey -alias key0 -keyalg RSA -keysize 2048 -validity 36500 -dname "CN=uapp" -keystore ' + keyFile;
      execSync(keyCommand, { stdio: 'inherit' });
      console.log('\n证书生成位置: ' + keyFile);
    } catch (error) {
      console.log('\n错误解决方法, 改名已存在的文件: ' + keyFile);
    }

    return;
  }

  // command:
  // uapp manifest path/to/manifest.json
  if (cmd === 'manifest') {
    let manifestFile = args.argv.remain[1];
    if (manifestFile && !fs.existsSync(manifestFile)) {
      console.log('找不到: ' + manifestFile);
      return;
    }

    if (manifestFile) {
      $G.localLinkManifest = path.join($G.appDir, '/manifest.json');
      try {
        let fstats = fs.lstatSync($G.localLinkManifest);
        if (fstats.isSymbolicLink()) {
          fs.unlinkSync($G.localLinkManifest);
        } else {
          let backupName = 'manifest-' + new Date().getTime() + '.json';
          console.log('注意：将已存在 manifest.json 文件更名为: ' + backupName);
          fs.renameSync($G.localLinkManifest, $G.localLinkManifest.replace('manifest.json', backupName));
        }
      } catch (error) {}

      fs.symlinkSync(manifestFile, $G.localLinkManifest);
    }

    if (!fs.existsSync($G.localLinkManifest)) {
      console.log('文件不存在: ' + $G.localLinkManifest);
      console.log('配置命令为: uapp manifest path/to/manifest.json');
      return;
    }

    loadManifest();
    printManifestInfo();
    return;
  }

  // 加载 manifest.json 数据
  loadManifest();
  $G.webAppDir = path.dirname(fs.realpathSync($G.localLinkManifest));

  // command: uapp info, uapp info jwt, uapp info key
  if (cmd === 'info' && (!args.argv.remain[1] || args.argv.remain[1] === 'jwt' || args.argv.remain[1] === 'key')) {
    printManifestInfo();

    if (($G.projectType === 'ios' && !args.argv.remain[1]) || args.argv.remain[1] === 'jwt') {
      printJWTToken();
      return;
    }

    if ($G.projectType === 'android') {
      let keyFile = path.join($G.appDir, 'app/app.keystore');
      if (!fs.existsSync(keyFile)) {
        console.log('找不到 keystore 签名文件: ' + keyFile);
        return;
      }

      let gradle = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
      if (!fs.existsSync(path.resolve(gradle))) {
        console.log('找不到 gradle 命令: ' + gradle);
        return;
      }

      printAndroidKeyInfo(gradle);
      return;
    }
  }

  // command: uapp prepare
  if (cmd === 'prepare') {
    prepareCommand();
    return;
  }

  // command: uapp run custom
  if (cmd === 'run' && args.argv.remain[1] === 'custom') {
    let command = $G.manifest.uapp[`${$G.projectType}.custom.command`] || $G.manifest.uapp['custom.command'];
    if (!command) {
      console.log('自定义命令为空，请参照文档中的 custom.command 配置');
    } else {
      command = command.replace(/\$\{SRC\}/g, $G.webAppDir);
      execSync(command, { stdio: 'inherit' });
    }
    return;
  }

  // commands:
  // 先判断 projectType, webapp, android, ios
  // webapp 时支持: uapp run dev:xxx , uapp run build:xxx
  // uapp run build
  // uapp run build:dev { --no-copy | 不复制到 hbx 自定义基座 }
  if (cmd === 'run') {
    console.log('当前工程类型为 ' + chalk.yellow($G.projectType));

    // webapp 支持 dev:xxx, build:xxx
    if ($G.projectType === 'webapp') {
      let [a, b] = args.argv.remain[1].split(':');
      if (!['build', 'dev'].includes(a) || !b) {
        return console.log('命令无效，webapp 仅支持 uapp run build:xxx / dev:xxx');
      }

      return buildWebApp(args.argv.remain[1]);
    }

    if (!['build', 'build:dev'].includes(args.argv.remain[1])) {
      return console.log('命令无效，app 仅支持 uapp run build / build:dev');
    }

    if (args.prepare) {
      prepareCommand();
    }

    let buildType = args.argv.remain[1];
    if ($G.projectType === 'android') {
      let assembleTypeMap = {
        'build': 'assembleRelease',
        'build:dev': 'assembleDebug'
      };

      let outFileMap = {
        'build': 'release/app-release.apk',
        'build:dev': 'debug/app-debug.apk'
      };

      let gradle = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
      execSync(gradle + ` ${assembleTypeMap[buildType]}`, { stdio: 'inherit' });
      let buildOutFile = path.join($G.appDir, 'app/build/outputs/apk/', outFileMap[buildType]);

      if (buildType === 'build:dev' && args.copy) {
        sync(buildOutFile, path.join($G.webAppDir, 'unpackage/debug/android_debug.apk'), { delete: true });
      }

      console.log('\n编译成功，安装包位置: ');
      console.log(buildOutFile);
      return;
    }

    if ($G.projectType === 'ios') {
      if (buildType !== 'build:dev') {
        console.log('iOS 仅支持自定义基座打包`uapp run build:dev`，如正式版发布请直接使用 xcode');
        return;
      }

      try {
        execSync('xcodegen', { stdio: 'inherit' });
      } catch (e) {
        console.log('请先安装 xcodegen, 可通过 brew install xcodegen 安装, 参考 iOS 配置文档: ');
        console.log('👉 https://gitee.com/uappkit/platform/blob/main/ios/README.md');
        return;
      }

      // gererate uapp_debug.xcarchive
      execSync(
        'xcodebuild -project uapp.xcodeproj -destination "generic/platform=iOS" -scheme "HBuilder" -archivePath out/uapp_debug.xcarchive archive',
        { stdio: 'inherit' }
      );

      // generate ipa
      execSync(
        'xcodebuild -exportArchive -archivePath out/uapp_debug.xcarchive -exportPath out -exportOptionsPlist config/export.plist',
        { stdio: 'inherit' }
      );

      if (args.copy) {
        sync(
          path.join($G.appDir, 'out/HBuilder.ipa'),
          path.join($G.webAppDir, 'unpackage/debug/ios_debug.ipa'),
          { delete: true }
        );
      }
      return;
    }

    console.log('无法识别的工程模板，请参考帮助');
    return;
  }

  // command: uapp publish debug
  if (cmd === 'publish' && args.argv.remain[1] === 'debug') {
    console.log('此命令已弃用，请使用 uapp run build:dev');
    return;
  }

  printHelp();
};

function checkForUpdates() {
  try {
    // Checks for available update and returns an instance
    const notifier = updateNotifier({ pkg: pkg });

    if (notifier.update && notifier.update.latest !== pkg.version) {
      // Notify using the built-in convenience method
      notifier.notify();
    }
  } catch (e) {
    // https://issues.apache.org/jira/browse/CB-10062
    if (e && e.message && /EACCES/.test(e.message)) {
      console.log('Update notifier was not able to access the config file.');
    } else {
      throw e;
    }
  }
}

function getFiles(dir, files_) {
  files_ = files_ || [];
  const files = fs.readdirSync(dir);
  for (let i in files) {
    const name = path.join(dir, files[i]);
    if (fs.statSync(name).isDirectory()) {
      getFiles(name, files_);
    } else {
      files_.push(name);
    }
  }
  return files_;
}

function checkManifest() {
  if (!fs.existsSync($G.localLinkManifest)) {
    console.log('请先执行 `uapp manifest path/to/manifest.json` 指定 manifest.json 文件');
    process.exit();
  }
}

function loadManifest() {
  checkManifest();
  console.log('当前使用 manifest: ' + $G.localLinkManifest);

  if (fs.existsSync($G.localLinkManifest)) {
    let content = fs.readFileSync($G.localLinkManifest, 'utf8');
    $G.manifest = JSON.parse(stripJsonComments(content));
  }

  if (
    !['android', 'ios'].includes($G.projectType) &&
    ($G.args.argv.remain[0] === 'run' && !$G.args.argv.remain[1].includes(':app'))
  ) {
    return;
  }

  if (!$G.manifest.appid) {
    console.log(chalk.yellow('manifest.json 中缺少 appid，请打开 HBuilderX 获取'));
  }

  if (!$G.manifest.uapp) {
    console.log(chalk.yellow('manifest.json 中缺少 uapp 节点，请复制并添加如下内容'));
    console.log(`
"uapp": {
  "name": "μAppKit",
  "package": "com.code0xff.uapp",
  "android.appkey": "申请并替换为 android dcloudkey",
  "ios.appkey": "申请并替换为 ios dcloudkey"
},
    `);
    process.exit();
  }

  $G.manifest.uapp.name = $G.manifest.uapp[`${$G.projectType}.name`] || $G.manifest.uapp.name || $G.manifest.name;
  $G.manifest.uapp.package = $G.manifest.uapp[`${$G.projectType}.package`] || $G.manifest.uapp.package || '';
  $G.manifest.uapp.versionName = $G.manifest.uapp[`${$G.projectType}.versionName`] || $G.manifest.versionName;
  $G.manifest.uapp.versionCode = $G.manifest.uapp[`${$G.projectType}.versionCode`] || $G.manifest.versionCode;
  $G.manifest.uapp.appkey = $G.manifest.uapp[`${$G.projectType}.appkey`];

  // 缺失的参数，默认使用模版里的
  $G.manifest = _.merge(require($G.sdkHomeDir + '/templates/manifest.json'), $G.manifest);
}

function prepareCommand() {
  if ($G.args.webapp) {
    buildWebApp('build:app-' + $G.projectType);
  }

  let compiledDir = path.join($G.webAppDir, 'unpackage/resources/', $G.manifest.appid);
  if (!pathExistsSync(compiledDir)) {
    console.log(chalk.red('找不到本地App打包资源'));
    console.log('请使用 HBuilderX => 发行(菜单) => 原生App本地打包 => 生成本地打包App资源');
    process.exit();
  }

  let resDir = path.join($G.webAppDir, 'unpackage/res/icons');
  // 如果没生成过图标目录, 跳过
  if (pathExistsSync(resDir)) {
    if ($G.projectType === 'android') {
      updateAndroidMetaData();
      updateAndroidIcons(resDir);
    } else if ($G.projectType === 'ios') {
      updateIOSMetaData();
      updateIOSIcons(resDir);
    }
  } else {
    console.log(chalk.yellow('未发现图标资源，跳过App图标更新'));
    console.log('更新图标请使用 HBuilderX => manifest.json 配置 => App图标配置 => 自动生成所有图标\n');
  }

  let embedAppsDir = path.join(
    $G.appDir,
    $G.projectType === 'ios' ? 'Main/Pandora/apps' : 'app/src/main/assets/apps'
  );

  emptyDirSync(embedAppsDir);
  sync(compiledDir, path.join(embedAppsDir, $G.manifest.appid));
  console.log(chalk.green('APP打包所需资源已更新'));
}

/*
 * android platform
 */

function updateAndroidMetaData() {
  let wxEntryActivityFile = 'WXEntryActivity.java';
  let wXPayEntryActivityFile = 'WXPayEntryActivity.java';

  let baseGradleFile = path.join($G.appDir, 'app/build.gradle');
  let content = fs.readFileSync(baseGradleFile, 'utf-8');

  content = content.replace(/(applicationId\s+")(.*)(")/, '$1' + $G.manifest.uapp.package + '$3');
  content = content.replace(/(app_name[',\s]+")(.*)(")/, '$1' + $G.manifest.uapp.name + '$3');
  content = content.replace(/(versionCode\s+)(.*)/, '$1' + $G.manifest.uapp.versionCode);
  content = content.replace(/(versionName\s+")(.*)(")/, '$1' + $G.manifest.uapp.versionName + '$3');
  content = content.replace(/("DCLOUD_APPKEY"\s+:\s+")(.*)(",)/, '$1' + $G.manifest.uapp.appkey + '$3');

  content = content.replace(
    /("WX_APPID"\s+:\s+")(.*)(",)/,
    '$1' + $G.manifest['app-plus'].distribute.sdkConfigs.oauth.weixin.appid + '$3'
  );

  content = content.replace(
    /("WX_SECRET"\s+:\s+")(.*)(",)/,
    '$1' + $G.manifest['app-plus'].distribute.sdkConfigs.oauth.weixin.appsecret + '$3'
  );
  fs.writeFileSync(baseGradleFile, content);

  let sourceDir = path.join($G.appDir, 'app/src/main/java/');
  for (const entryFile of [wxEntryActivityFile, wXPayEntryActivityFile]) {
    getFiles(sourceDir).forEach((file) => {
      file.endsWith(entryFile) && fs.unlinkSync(file);
    });
  }

  // DONT change content here
  let contentOfEntryFiles = {
    [wxEntryActivityFile]: `package ${$G.manifest.uapp.package}.wxapi;
import io.dcloud.feature.oauth.weixin.AbsWXCallbackActivity;
public class WXEntryActivity extends AbsWXCallbackActivity {
}
`,
    [wXPayEntryActivityFile]: `package ${$G.manifest.uapp.package}.wxapi;
import io.dcloud.feature.payment.weixin.AbsWXPayCallbackActivity;
public class WXPayEntryActivity extends AbsWXPayCallbackActivity{
}
`
  };

  for (const entryFile of [wxEntryActivityFile, wXPayEntryActivityFile]) {
    let replaceFile = path.join(
      $G.appDir,
      'app/src/main/java/',
      $G.manifest.uapp.package.replace(/\./g, '/'),
      'wxapi',
      entryFile
    );

    fs.mkdirSync(path.dirname(replaceFile), { recursive: true });
    fs.writeFileSync(replaceFile, contentOfEntryFiles[entryFile]);
  }

  replaceControlXml(path.join($G.appDir, 'app/src/debug/assets/data/dcloud_control.xml'));
  replaceControlXml(path.join($G.appDir, 'app/src/main/assets/data/dcloud_control.xml'));

  console.log('✅ updateAndroidMetaData');
}

function updateAndroidIcons(resDir) {
  sync(
    path.join(resDir, '144x144.png'),
    path.join($G.appDir, 'app/src/main/res/drawable-xxhdpi/icon.png')
  );
  console.log('✅ updateAndroidIcons');
}

/*
 * ios platform
 */

function updateIOSMetaData() {
  let baseYamlFile = path.join($G.appDir, 'config/base.yml');
  let content = fs.readFileSync(baseYamlFile, 'utf-8');

  content = content.replace(/(PRODUCT_BUNDLE_IDENTIFIER: )(.*)/, '$1' + $G.manifest.uapp.package);
  content = content.replace(/(MARKETING_VERSION: )(.*)/g, '$1' + $G.manifest.uapp.versionName);
  content = content.replace(/(CURRENT_PROJECT_VERSION: )(.*)/g, '$1' + $G.manifest.uapp.versionCode);
  fs.writeFileSync(baseYamlFile, content);

  replaceStoryboard(path.join($G.appDir, 'Main/Resources/LaunchScreen.storyboard'));
  replaceStoryboard(path.join($G.appDir, 'Main/Resources/LaunchScreenAD.storyboard'));

  replaceInfoPlist(path.join($G.appDir, 'Main/Resources/AppDev/Info.plist'));
  replaceInfoPlist(path.join($G.appDir, 'Main/Resources/AppRelease/Info.plist'));

  replaceControlXml(path.join($G.appDir, 'Main/Resources/AppDev/control.xml'));
  replaceControlXml(path.join($G.appDir, 'Main/Resources/AppRelease/control.xml'));

  let sdkLinkDir = path.join($G.appDir, '/SDKs/SDK');
  if (!fs.existsSync(sdkLinkDir)) {
    let iosSDKDir = path.join($G.sdkHomeDir, '/ios/SDK');
    if (!fs.existsSync(iosSDKDir)) {
      console.log('找不到iOS SDK，请参照 README 配置');
      console.log('SDK 位置: ' + iosSDKDir);
    } else {
      fs.symlinkSync(path.join($G.sdkHomeDir, '/ios/SDK'), sdkLinkDir, 'dir');
    }
  }

  console.log('✅ updateIOSMetaData');
}

function replaceStoryboard(storyboardFile) {
  let content = fs.readFileSync(storyboardFile, 'utf-8');
  const re = /(text=")(.+?)(".+)(?=uapp-launchscreen-appname)/;
  content = content.replace(re, '$1' + $G.manifest.uapp.name + '$3');
  fs.writeFileSync(storyboardFile, content);
}

function replaceInfoPlist(plistFile) {
  let content = fs.readFileSync(plistFile, 'utf-8');
  let re = /(<key>dcloud_appkey<\/key>\n.+?<string>)(.*?)(<\/string>)/g;
  content = content.replace(re, '$1' + $G.manifest.uapp.appkey + '$3');

  // replace ios and wexin meanwhile
  re = /(<key>UniversalLinks<\/key>\n.+?<string>)(.*?)(<\/string>)/g;
  content = content.replace(re,
    '$1' + $G.manifest['app-plus'].distribute.sdkConfigs.oauth.weixin.UniversalLinks + '$3');

  re = /(<key>weixin<\/key>[\s\S]+?appid<\/key>\n.+?<string>)(.*?)(<\/string>)/g;
  content = content.replace(re, '$1' + $G.manifest['app-plus'].distribute.sdkConfigs.oauth.weixin.appid + '$3');

  re = /(<string>weixin<\/string>\n.+?<key>CFBundleURLSchemes<\/key>[\s\S]+?<string>)(.*?)(<\/string>)/g;
  content = content.replace(re, '$1' + $G.manifest['app-plus'].distribute.sdkConfigs.oauth.weixin.appid + '$3');

  re = /(<key>weixin<\/key>[\s\S]+?appSecret<\/key>\n.+<string>)(.*?)(<\/string>)/g;
  content = content.replace(re, '$1' + $G.manifest['app-plus'].distribute.sdkConfigs.oauth.weixin.appsecret + '$3');

  re = /(<key>CFBundleDisplayName<\/key>\n.+?<string>)(.*?)(<\/string>)/g;
  if (!re.test(content)) {
    console.error('no CFBundleDisplayName, you should use xcode set Display Name first');
    process.exit(1);
  }

  content = content.replace(re, '$1' + $G.manifest.uapp.name + '$3');
  fs.writeFileSync(plistFile, content);
}

function replaceControlXml(xmlFile) {
  let content = fs.readFileSync(xmlFile, 'utf-8');
  let re = /(app appid=")(.+?)(")/g;
  content = content.replace(re, '$1' + $G.manifest.appid + '$3');
  fs.writeFileSync(xmlFile, content);
}

function updateIOSIcons(resDir) {
  let iconFiles = fs.readdirSync(resDir);
  iconFiles.forEach(function (file) {
    if (!file.endsWith('.png')) return;
    // skip android icons
    if (['72x72.png', '96x96.png', '144x144.png', '192x192.png'].includes(file)) return;

    const fullPath = path.join(resDir, file);
    sync(fullPath, path.join($G.appDir, '/Main/Resources/Images.xcassets/AppIcon.appiconset/', file), { delete: true });
  });

  sync(path.join(resDir, '120x120.png'), path.join($G.appDir, 'Main/Resources/logo@2x.png'));
  sync(path.join(resDir, '180x180.png'), path.join($G.appDir, 'Main/Resources/logo@3x.png'));
  console.log('✅ updateIOSIcons');
}

function printManifestInfo() {
  console.log();
  console.log('- appid       : ' + $G.manifest.appid);
  console.log('- appName     : ' + $G.manifest.uapp.name);
  console.log('- package     : ' + $G.manifest.uapp.package);
  console.log('- versionName : ' + $G.manifest.uapp.versionName);
  console.log('- versionCode : ' + $G.manifest.uapp.versionCode);
  if ($G.manifest.uapp.appkey) {
    console.log('- appKey      : ' + $G.manifest.uapp.appkey);
  }

  // for uniapp project
  console.log();
  console.log(`👇 DCloud 开发者后台配置 dcloud_appkey (uapp.${$G.projectType}.appkey): `);
  console.log('https://dev.dcloud.net.cn/pages/app/detail/info?tab=package&appid=' + $G.manifest.appid);
  console.log();
}

// generate jwt token for apple oauth login
function printJWTToken() {
  console.log('------ JWT Token ------');
  try {
    let config = require(path.join($G.appDir, 'jwt/config.json'));

    if (!config.team_id) {
      let content = fs.readFileSync(path.join($G.appDir, 'config/custom.yml'), 'utf-8');
      let r = content.match(/DEVELOPMENT_TEAM:\s+(.*)/);
      config.team_id = r[1] || '';
    }

    if (!config.team_id) {
      throw '请在 jwt/config.json 中设置 team_id';
    }

    let privateKey = fs.readFileSync(path.join($G.appDir, 'jwt/key.txt'));
    let headers = { kid: config.key_id };
    let timestamp = Math.floor(Date.now() / 1000);
    let claims = {
      iss: config.team_id,
      iat: timestamp,
      exp: timestamp + 86400 * 180,
      aud: 'https://appleid.apple.com',
      sub: config.client_id
    };

    const jwt = require('jsonwebtoken');
    let token = jwt.sign(claims, privateKey, { algorithm: 'ES256', header: headers });
    console.log(token);
  } catch (error) {
    console.log(error.message + '\n');
    console.log('jwt/config.json 内容参考: ');
    console.log(`
{
    "team_id": "3DSM494K6L",
    "client_id": "com.code0xff.uapp.login",
    "key_id": "3C7FMSZC8Z"
}
    `);
  }

  console.log();
  console.log('👉 参考教程: http://help.jwt.code0xff.com');
}

function printAndroidKeyInfo(gradle) {
  let output = execSync(gradle + ' app:signingReport').toString();
  let r;
  if (output.indexOf('Invalid keystore format') > 0) {
    r = output.match(/Error: ([\s\S]+?)\n----------/);
    console.log('签名文件错误: ' + r[1]);
    console.log('问题可能因为创建 app.keystore 时使用的java版本和当前不一致，可更换java版本后再尝试');
    console.log('\n------ 当前java版本 ------');
    return execSync('java -version', { stdio: 'inherit' });
  }

  r = output.match(/Variant: release[\s\S]+?----------/);
  let md5 = r[0].match(/MD5: (.+)/)[1].replace(/:/g, '');
  let sha1 = r[0].match(/SHA1: (.+)/)[1];
  console.log('👇 应用签名 (MD5), 用于微信开放平台:');
  console.log(md5);
  console.log();
  console.log('👇 Android 证书签名 (SHA1), 用于离线打包 Key:');
  console.log(sha1);

  console.log();
  console.log('----------');
  console.log(r[0]);
}

function buildWebApp(buildArg) {
  let hbxDir = $G.config['hbx.dir'];
  if (!fs.existsSync(hbxDir)) {
    console.log('文件不存在: ' + $G.config['hbx.dir']);
    console.log('配置 HBuilderX 环境命令: ' + chalk.yellow('uapp config hbx.dir [path/to/HBuilderX]'));
    process.exit();
  }

  if (process.platform === 'darwin' && fs.existsSync(path.join(hbxDir, 'Contents/HBuilderX'))) {
    hbxDir = path.join(hbxDir, 'Contents/HBuilderX');
  }

  let node = path.join(hbxDir, 'plugins/node/node');
  if (!fs.existsSync(node)) {
    node = $G.config.node;
  }

  if (!node || !fs.existsSync(node)) {
    console.log('找不到 node 位置: ' + node);
    console.log('配置 node: ' + chalk.yellow('uapp config node [path/to/node]'));
    process.exit();
  }

  let vue = 'vue2';
  let spawnArgs = [];
  let buildScript;

  let flag = buildArg.startsWith('build') ? 'build' : '';
  let isWeixin = buildArg.endsWith('mp-weixin');

  if (Number($G.manifest.vueVersion) === 3) {
    vue = 'vue3';
    buildScript = path.join(hbxDir, 'plugins/uniapp-cli-vite/node_modules/@dcloudio/vite-plugin-uni/bin/uni.js');
    spawnArgs = [buildScript, flag, '-p', buildArg.split(':')[1]];
  } else {
    buildScript = path.join(hbxDir, 'plugins/uniapp-cli/bin/uniapp-cli.js');
    process.env.NODE_PATH = path.join(hbxDir, 'plugins/uniapp-cli/node_modules');
    process.env.VUE_CLI_CONTEXT = process.env.UNI_CLI_CONTEXT = path.join(hbxDir, 'plugins/uniapp-cli');
    process.env.UNI_PLATFORM = buildArg.split(':')[1];
    spawnArgs = [buildScript];
  }

  if (!fs.existsSync(buildScript)) {
    console.log(chalk.yellow(`HBuilderX 需要安装插件 => uni-app (${vue}) 编译器`));
    process.exit();
  }

  let buildOutDir = $G.args.out;
  if (!buildOutDir) {
    buildOutDir = getDefaultBuildOut(buildArg);
  }

  process.env.HX_Version = '3.x';
  process.env.HX_APP_ROOT = process.env.APP_ROOT = hbxDir;
  process.env.UNI_INPUT_DIR = $G.webAppDir;
  process.env.UNI_OUTPUT_DIR = buildOutDir;
  process.env.NODE_ENV = flag === 'build' ? 'production' : 'development';

  if (flag) {
    spawnSync(node, spawnArgs, { stdio: 'inherit' });
    if ($G.args.open && isWeixin) {
      runWeixinCli(['open', '--project', buildOutDir]);
    }
  } else {
    let p = spawn(node, spawnArgs);
    let first = true;
    p.stdout.on('data', data => {
      data = data.toString();
      process.stdout.write(data);

      if ($G.args.open &&
        isWeixin &&
        first &&
        (data.includes('Watching for changes') || data.includes('ready in '))
      ) {
        first = false;
        runWeixinCli(['open', '--project', buildOutDir]);
      }
    });

    p.stderr.on('data', data => {
      process.stderr.write(data.toString());
    });
  }
}

function getDefaultBuildOut(buildArg) {
  let isDev = buildArg.startsWith('dev:');
  let relativeDir = '';

  if (buildArg.startsWith('build:app')) {
    relativeDir = 'unpackage/resources/' + $G.manifest.appid + '/www';
  } else if (isDev) {
    relativeDir = 'unpackage/dist/dev/' + buildArg.split(':')[1];
  } else {
    relativeDir = 'unpackage/dist/build/' + buildArg.split(':')[1];
  }

  return path.join($G.webAppDir, relativeDir);
}

function runHBuilderXCli(args) {
  let cli = 'cli';
  if (process.platform === 'darwin') {
    if (fs.existsSync(path.join($G.config['hbx.dir'], '../MacOS/cli'))) {
      cli = '../MacOS/cli';
    } else {
      cli = 'Contents/MacOS/cli';
    }
  }
  cli = path.join($G.config['hbx.dir'], cli);

  if (!fs.existsSync(cli)) {
    console.log('文件不存在: ' + cli);
    return console.log('配置 HBuilderX 环境命令: ' + chalk.yellow('uapp config hbx.dir [path/to/HBuilderX]'));
  }

  return spawnSync(cli, args, { stdio: 'inherit' });
}

function runWeixinCli(args) {
  let cli = process.platform === 'darwin' ? 'Contents/MacOS/cli' : 'cli';
  cli = path.join($G.config['wx.dir'], cli);

  if (!fs.existsSync(cli)) {
    console.log('文件不存在: ' + cli);
    return console.log('配置微信环境命令: ' + chalk.yellow('uapp config wx.dir [path/to/weixin]'));
  }

  spawnSync(cli, args, { stdio: 'inherit' });
}

function clone(url, projectName) {
  const spinner = ora();
  spinner.start('正在下载中，请稍后...');
  tiged(url, { cache: true, force: false, verbose: true })
    .on('info', info => {
      spinner.succeed(info.message);
    })
    .clone(projectName);
}

function printHelp() {
  console.log(fs.readFileSync(path.join(__dirname, '../doc/help.txt'), 'utf-8'));
}
