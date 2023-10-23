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
const path = require('path');
const tiged = require('tiged');
const chalk = require('chalk');
const pkg = require('../package.json');
const sync = require('./sync');
const stripJsonComments = require('./stripJsonComments');
const { removeSync, pathExistsSync } = require('fs-extra');

const knownOpts = {
  version: Boolean,
  help: Boolean,
  typescript: Boolean,
  alpha: Boolean,
  vue2: Boolean,
  'no-copy': Boolean
};

const shortHands = {
  v: '--version',
  h: '--help'
};

const appDir = process.cwd();
const sdkHomeDir = path.join(require('os').homedir(), '.uappsdk');
let localLinkManifest = path.join(appDir, 'manifest.json');
let manifest = '';

module.exports = function (inputArgs) {
  checkForUpdates();

  const args = nopt(knownOpts, shortHands, inputArgs);
  if (args.version) {
    console.log('uapp 当前版本: ' + pkg.version);
    return;
  }

  // command: uapp help
  const cmd = args.argv.remain[0] || 'help';
  if (!cmd || cmd === 'help' || args.help) {
    printHelp();
    return;
  }

  // 如果当面目录不存在 manifest.json，尝试使用 ../src/manifest.json
  if (!fs.existsSync(localLinkManifest)) {
    let tryManifestFile = path.resolve(path.join(appDir, '../src/manifest.json'));
    if (fs.existsSync(tryManifestFile)) {
      localLinkManifest = tryManifestFile;
    }
  }

  // command: uapp new
  if (cmd === 'new') {
    let projectName = args.argv.remain[1];
    if (projectName) {
      if (args.vue2) {
        // vue2 必须使用小写
        let baseCommand = args.alpha
          ? 'vue create -p dcloudio/uni-preset-vue#alpha '
          : 'vue create -p dcloudio/uni-preset-vue ';
        try {
          require('child_process').execSync(baseCommand + projectName.toLowerCase(), { stdio: 'inherit' });
        } catch (error) {
          console.log('请先安装 vue 环境:');
          console.log('npm i -g @vue/cli');
        }
      } else {
        let branch = args.alpha ? '#vite-alpha' : '#vite';
        if (args.typescript) {
          branch = '#vite-ts';
        }

        tiged(`git@gitee.com:dcloud/uni-preset-vue.git${branch}`, { cache: true, force: false, verbose: true })
          .on('info', info => {
            console.log(info.message);
          })
          .clone(projectName);
      }
      return;
    }
  }

  // command: uapp sdk init
  if (cmd === 'sdk' && args.argv.remain[1] === 'init') {
    sync(path.resolve(__dirname, '../uappsdk'), sdkHomeDir);
    console.log(chalk.green('--- uappsdk 已安装 ---'));
    return;
  }

  // check project
  let projectType = 'unknown';
  if (fs.existsSync(path.join(appDir, 'Main/AppDelegate.m'))) {
    projectType = 'ios';
  } else if (fs.existsSync(path.join(appDir, '/app/build.gradle'))) {
    projectType = 'android';
  }

  // command: uapp keygen
  if (cmd === 'keygen') {
    if (projectType === 'android') {
      console.log('注意: ');
      console.log('build.gradle 中密码默认为 123456, 如有修改为其他密码，请对应修改 build.gradle 中的配置');
    }
    console.log('需要输入两次6位密码, 例如输入密码: 123456\n');

    let keyFile = path.join(appDir, 'app/app.keystore');
    fs.mkdirSync(path.dirname(keyFile), { recursive: true });

    try {
      let keyCommand =
        'keytool -genkey -alias key0 -keyalg RSA -keysize 2048 -validity 36500 -dname "CN=uapp" -keystore ' + keyFile;
      require('child_process').execSync(keyCommand, { stdio: 'inherit' });
      console.log('\n证书生成位置: ' + keyFile);
    } catch (error) {
      console.log('\n错误解决方法, 改名已存在的文件: ' + keyFile);
    }

    return;
  }

  // command: uapp info, uapp info jwt, uapp info key
  if (cmd === 'info' && (!args.argv.remain[1] || args.argv.remain[1] === 'jwt' || args.argv.remain[1] === 'key')) {
    printManifestInfo(projectType);

    if ((projectType === 'ios' && !args.argv.remain[1]) || args.argv.remain[1] === 'jwt') {
      printJWTToken();
      return;
    }

    if (projectType === 'android') {
      let keyFile = path.join(appDir, 'app/app.keystore');
      if (!fs.existsSync(keyFile)) {
        console.log('找不到 keystore 签名文件: ' + keyFile);
        return;
      }

      let gradle = require('os').type() === 'Windows_NT' ? 'gradlew.bat' : './gradlew';
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
    let srcDir = path.dirname(fs.realpathSync(localLinkManifest));
    let resDir = path.join(srcDir, 'unpackage/res/icons');
    // 如果没生成过图标目录, 跳过
    if (pathExistsSync(resDir)) {
      if (projectType === 'android') {
        iconsSyncToAndroid(resDir);
      } else if (projectType === 'ios') {
        iconsSyncToIOS(resDir);
      }
    } else {
      console.log('未发现图标资源，跳过App图标更新');
      console.log('请先使用 HBuilderX => manifest.json 配置里的 App图标配置，自动生成所有图标。再运行 uapp prepare 替换');
    }

    checkManifest();
    manifest = getManifest();
    let compiledDir = path.join(srcDir, 'unpackage/resources/', manifest.appid);
    let embedAppsDir = path.join(
      appDir,
      projectType === 'ios' ? 'Main/Pandora/apps' : 'app/src/main/assets/apps',
      manifest.appid
    );

    fs.existsSync(embedAppsDir) && removeSync(embedAppsDir);
    fs.mkdirSync(embedAppsDir, { recursive: true });
    sync(compiledDir, embedAppsDir);
    console.log(chalk.green('打包APP资源已就绪'));
    return;
  }

  // command: uapp run custom
  if (cmd === 'run' && args.argv.remain[1] === 'custom') {
    manifest = getManifest();
    let command = manifest.uapp[`${projectType}.custom.command`] || manifest.uapp['custom.command'];
    if (!command) {
      console.log('自定义命令为空，请参照文档中的 custom.command 配置');
    } else {
      let srcDir = path.dirname(fs.realpathSync(localLinkManifest));
      command = command.replace(/\$\{SRC\}/g, srcDir);
      require('child_process').execSync(command, { stdio: 'inherit' });
    }
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

    return tiged(`git@gitee.com:uappkit/platform.git/${platform}#main`, { cache: true, force: false, verbose: true })
      .on('info', info => {
        console.log(info.message);
      })
      .clone(platform);
  }

  // commands:
  // uapp run build
  // uapp run build:dev { --no-copy | 不复制到 hbx 自定义基座 }
  if (cmd === 'run' && (args.argv.remain[1] === 'build' || args.argv.remain[1] === 'build:dev')) {
    checkManifest();

    let buildType = args.argv.remain[1];
    if (projectType === 'android') {
      let assembleTypeMap = {
        'build': 'assembleRelease',
        'build:dev': 'assembleDebug'
      };

      let outFileMap = {
        'build': 'release/app-release.apk',
        'build:dev': 'debug/app-debug.apk'
      };

      let gradle = require('os').type() === 'Windows_NT' ? 'gradlew.bat' : './gradlew';
      require('child_process').execSync(gradle + ` ${assembleTypeMap[buildType]}`, { stdio: 'inherit' });
      let buildOutFile = path.join(appDir, 'app/build/outputs/apk/', outFileMap[buildType]);

      if (buildType === 'build:dev' && args.copy) {
        sync(
          buildOutFile,
          path.join(path.dirname(fs.realpathSync(localLinkManifest)), 'unpackage/debug/android_debug.apk')
        );
      }

      console.log('\n编译成功，安装包位置: ');
      console.log(buildOutFile);
      return;
    }

    if (projectType === 'ios') {
      if (buildType !== 'build:dev') {
        console.log('iOS仅支持自定义基座打包`uapp run build:dev`，如正式版发布请直接使用 xcode');
        return;
      }

      // gererate uapp_debug.xcarchive
      require('child_process').execSync(
        'xcodebuild -project uapp.xcodeproj -destination "generic/platform=iOS" -scheme "HBuilder" -archivePath out/uapp_debug.xcarchive archive',
        { stdio: 'inherit' }
      );

      // generate ipa
      require('child_process').execSync(
        'xcodebuild -exportArchive -archivePath out/uapp_debug.xcarchive -exportPath out -exportOptionsPlist config/export.plist',
        { stdio: 'inherit' }
      );

      if (args.copy) {
        sync(
          path.join(appDir, 'out/HBuilder.ipa'),
          path.join(path.dirname(fs.realpathSync(localLinkManifest)), 'unpackage/debug/ios_debug.ipa')
        );
      }
      return;
    }

    console.log('无法识别的工程模板，请参考帮助');
    return;
  }

  // commands:
  // uapp manifest path/to/manifest.json
  if (cmd === 'manifest') {
    let manifestFile = args.argv.remain[1];
    if (manifestFile && !fs.existsSync(manifestFile)) {
      console.log('找不到: ' + manifestFile);
      return;
    }

    if (manifestFile) {
      localLinkManifest = path.join(appDir, '/manifest.json');
      try {
        let fstats = fs.lstatSync(localLinkManifest);
        if (fstats.isSymbolicLink()) {
          fs.unlinkSync(localLinkManifest);
        } else {
          let backupName = 'manifest-' + new Date().getTime() + '.json';
          console.log('注意：将已存在 manifest.json 文件更名为: ' + backupName);
          fs.renameSync(localLinkManifest, localLinkManifest.replace('manifest.json', backupName));
        }
      } catch (error) {}

      fs.symlinkSync(manifestFile, localLinkManifest);
    }

    if (!fs.existsSync(localLinkManifest)) {
      console.log('找不到 manifest.json 文件，可参照下面命令: ');
      console.log('uapp manifest path/to/manifest.json');
      return;
    }

    console.log('当前使用 manifest: ' + manifestFile);
    printManifestInfo(projectType);

    if (projectType === 'android') {
      processAndroid();
    } else if (projectType === 'ios') {
      processIOS();
    }

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

function cleanEmptyFoldersRecursively(folder) {
  const fs = require('fs');
  const path = require('path');

  if (!fs.statSync(folder).isDirectory()) {
    return;
  }

  let files = fs.readdirSync(folder);
  if (files.length > 0) {
    files.forEach(function (file) {
      const fullPath = path.join(folder, file);
      cleanEmptyFoldersRecursively(fullPath);
    });

    // re-evaluate files; after deleting subfolder
    // we may have parent folder empty now
    files = fs.readdirSync(folder);
  }

  if (files.length === 0) {
    removeSync(folder);
  }
}

function checkManifest() {
  if (!fs.existsSync(localLinkManifest)) {
    console.log('请先执行 `uapp manifest sync` 指定 manifest.json 文件');
    process.exit(-1);
  }
}

function getManifest() {
  if (fs.existsSync(localLinkManifest)) {
    let content = fs.readFileSync(localLinkManifest, 'utf8');
    manifest = JSON.parse(stripJsonComments(content));
  }

  if (!manifest.uapp) {
    throw new Error('manifest.json 中缺少 uapp 相关配置，请查看文档');
  }

  // 缺失的参数，默认使用模版里的
  manifest = _.merge(require(sdkHomeDir + '/templates/manifest.json'), manifest);
  return manifest;
}

/*
 * android platform
 */

function processAndroid() {
  let wxEntryActivityFile = 'WXEntryActivity.java';
  let wXPayEntryActivityFile = 'WXPayEntryActivity.java';

  let baseGradleFile = path.join(appDir, 'app/build.gradle');
  let content = fs.readFileSync(baseGradleFile, 'utf-8');

  content = content.replace(/(applicationId\s+")(.*)(")/, '$1' + manifest.uapp.package + '$3');
  content = content.replace(/(app_name[',\s]+")(.*)(")/, '$1' + manifest.uapp.name + '$3');
  content = content.replace(/(versionCode\s+)(.*)/, '$1' + manifest.uapp.versionCode);
  content = content.replace(/(versionName\s+")(.*)(")/, '$1' + manifest.uapp.versionName + '$3');
  content = content.replace(/("DCLOUD_APPKEY"\s+:\s+")(.*)(",)/, '$1' + manifest.uapp.appkey + '$3');

  content = content.replace(
    /("WX_APPID"\s+:\s+")(.*)(",)/,
    '$1' + manifest['app-plus'].distribute.sdkConfigs.oauth.weixin.appid + '$3'
  );

  content = content.replace(
    /("WX_SECRET"\s+:\s+")(.*)(",)/,
    '$1' + manifest['app-plus'].distribute.sdkConfigs.oauth.weixin.appsecret + '$3'
  );
  fs.writeFileSync(baseGradleFile, content);

  let sourceDir = path.join(appDir, 'app/src/main/java/');
  for (const entryFile of [wxEntryActivityFile, wXPayEntryActivityFile]) {
    getFiles(sourceDir).forEach((file) => {
      file.endsWith(entryFile) && fs.unlinkSync(file);
    });
  }

  // cleanup empty folder
  cleanEmptyFoldersRecursively(sourceDir);

  // DONT change content here
  let contentOfEntryFiles = {
    [wxEntryActivityFile]: `package ${manifest.uapp.package}.wxapi;
import io.dcloud.feature.oauth.weixin.AbsWXCallbackActivity;
public class WXEntryActivity extends AbsWXCallbackActivity {
}
`,
    [wXPayEntryActivityFile]: `package ${manifest.uapp.package}.wxapi;
import io.dcloud.feature.payment.weixin.AbsWXPayCallbackActivity;
public class WXPayEntryActivity extends AbsWXPayCallbackActivity{
}
`
  };

  for (const entryFile of [wxEntryActivityFile, wXPayEntryActivityFile]) {
    let replaceFile = path.join(
      appDir,
      'app/src/main/java/',
      manifest.uapp.package.replace(/\./g, '/'),
      'wxapi',
      entryFile
    );

    fs.mkdirSync(path.dirname(replaceFile), { recursive: true });
    fs.writeFileSync(replaceFile, contentOfEntryFiles[entryFile]);
  }

  replaceControlXml(path.join(appDir, 'app/src/debug/assets/data/dcloud_control.xml'));
  replaceControlXml(path.join(appDir, 'app/src/main/assets/data/dcloud_control.xml'));

  console.log('processAndroid successfully');
}

function iconsSyncToAndroid(resDir) {
  sync(
    path.join(resDir, '144x144.png'),
    path.join(appDir, 'app/src/main/res/drawable-xxhdpi/icon.png')
  );
}

/*
 * ios platform
 */

function processIOS() {
  let baseYamlFile = path.join(appDir, 'config/base.yml');
  let content = fs.readFileSync(baseYamlFile, 'utf-8');

  content = content.replace(/(PRODUCT_BUNDLE_IDENTIFIER: )(.*)/, '$1' + manifest.uapp.package);
  content = content.replace(/(MARKETING_VERSION: )(.*)/g, '$1' + manifest.uapp.versionName);
  content = content.replace(/(CURRENT_PROJECT_VERSION: )(.*)/g, '$1' + manifest.uapp.versionCode);
  fs.writeFileSync(baseYamlFile, content);

  replaceStoryboard(path.join(appDir, 'Main/Resources/LaunchScreen.storyboard'));
  replaceStoryboard(path.join(appDir, 'Main/Resources/LaunchScreenAD.storyboard'));

  replaceInfoPlist(path.join(appDir, 'Main/Resources/AppDev/Info.plist'));
  replaceInfoPlist(path.join(appDir, 'Main/Resources/AppRelease/Info.plist'));

  replaceControlXml(path.join(appDir, 'Main/Resources/AppDev/control.xml'));
  replaceControlXml(path.join(appDir, 'Main/Resources/AppRelease/control.xml'));

  let sdkLinkDir = path.join(appDir, '/SDKs/SDK');
  if (!fs.existsSync(sdkLinkDir)) {
    let iosSDKDir = path.join(sdkHomeDir, '/ios/SDK');
    if (!fs.existsSync(iosSDKDir)) {
      console.log('找不到iOS SDK，请参照 README 配置');
      console.log('SDK 位置: ' + iosSDKDir);
    } else {
      fs.symlinkSync(path.join(sdkHomeDir, '/ios/SDK'), sdkLinkDir, 'dir');
    }
  }

  // require('child_process').execSync('xcodegen', { stdio: 'inherit' });
  console.log('processIOS successfully');
}

function replaceStoryboard(storyboardFile) {
  let content = fs.readFileSync(storyboardFile, 'utf-8');
  const re = /(text=")(.+?)(".+)(?=uapp-launchscreen-appname)/;
  content = content.replace(re, '$1' + manifest.uapp.name + '$3');
  fs.writeFileSync(storyboardFile, content);
}

function replaceInfoPlist(plistFile) {
  let content = fs.readFileSync(plistFile, 'utf-8');
  let re = /(<key>dcloud_appkey<\/key>\n.+?<string>)(.*?)(<\/string>)/g;
  content = content.replace(re, '$1' + manifest.uapp.appkey + '$3');

  // replace ios and wexin meanwhile
  re = /(<key>UniversalLinks<\/key>\n.+?<string>)(.*?)(<\/string>)/g;
  content = content.replace(re, '$1' + manifest['app-plus'].distribute.sdkConfigs.oauth.weixin.UniversalLinks + '$3');

  re = /(<key>weixin<\/key>[\s\S]+?appid<\/key>\n.+?<string>)(.*?)(<\/string>)/g;
  content = content.replace(re, '$1' + manifest['app-plus'].distribute.sdkConfigs.oauth.weixin.appid + '$3');

  re = /(<string>weixin<\/string>\n.+?<key>CFBundleURLSchemes<\/key>[\s\S]+?<string>)(.*?)(<\/string>)/g;
  content = content.replace(re, '$1' + manifest['app-plus'].distribute.sdkConfigs.oauth.weixin.appid + '$3');

  re = /(<key>weixin<\/key>[\s\S]+?appSecret<\/key>\n.+<string>)(.*?)(<\/string>)/g;
  content = content.replace(re, '$1' + manifest['app-plus'].distribute.sdkConfigs.oauth.weixin.appsecret + '$3');

  re = /(<key>CFBundleDisplayName<\/key>\n.+?<string>)(.*?)(<\/string>)/g;
  if (!re.test(content)) {
    console.error('no CFBundleDisplayName, you should use xcode set Display Name first');
    process.exit(1);
  }

  content = content.replace(re, '$1' + manifest.uapp.name + '$3');
  fs.writeFileSync(plistFile, content);
}

function replaceControlXml(xmlFile) {
  let content = fs.readFileSync(xmlFile, 'utf-8');
  let re = /(app appid=")(.+?)(")/g;
  content = content.replace(re, '$1' + manifest.appid + '$3');
  fs.writeFileSync(xmlFile, content);
}

function iconsSyncToIOS(resDir) {
  let iconFiles = fs.readdirSync(resDir);
  iconFiles.forEach(function (file) {
    if (!file.endsWith('.png')) return;
    // skip android icons
    if (['72x72.png', '96x96.png', '144x144.png', '192x192.png'].includes(file)) return;

    const fullPath = path.join(resDir, file);
    sync(fullPath, path.join(appDir, '/Main/Resources/Images.xcassets/AppIcon.appiconset/', file));
  });

  sync(path.join(resDir, '120x120.png'), path.join(appDir, 'Main/Resources/logo@2x.png'));
  sync(path.join(resDir, '180x180.png'), path.join(appDir, 'Main/Resources/logo@3x.png'));
}

function printManifestInfo(projectType) {
  let manifest = getManifest();
  manifest.uapp.name = manifest.uapp[`${projectType}.name`] || manifest.uapp.name || manifest.name;
  manifest.uapp.package = manifest.uapp[`${projectType}.package`] || manifest.uapp.package || '';
  manifest.uapp.versionName = manifest.uapp[`${projectType}.versionName`] || manifest.versionName;
  manifest.uapp.versionCode = manifest.uapp[`${projectType}.versionCode`] || manifest.versionCode;
  manifest.uapp.appkey = manifest.uapp[`${projectType}.appkey`];

  console.log();
  console.log('- appid       : ' + manifest.appid);
  console.log('- appName     : ' + manifest.uapp.name);
  console.log('- package     : ' + manifest.uapp.package);
  console.log('- versionName : ' + manifest.uapp.versionName);
  console.log('- versionCode : ' + manifest.uapp.versionCode);
  if (manifest.uapp.appkey) {
    console.log('- appKey      : ' + manifest.uapp.appkey);
  }

  // for uniapp project
  console.log();
  console.log(`👇 DCloud 开发者后台配置 dcloud_appkey (uapp.${projectType}.appkey): `);
  console.log('https://dev.dcloud.net.cn/pages/app/detail/info?tab=package&appid=' + manifest.appid);
  console.log();
}

// generate jwt token for apple oauth login
function printJWTToken() {
  console.log('------ JWT Token ------');
  try {
    let config = require(path.join(appDir, 'jwt/config.json'));

    if (!config.team_id) {
      let content = fs.readFileSync(path.join(appDir, 'config/custom.yml'), 'utf-8');
      let r = content.match(/DEVELOPMENT_TEAM:\s+(.*)/);
      config.team_id = r[1] || '';
    }

    if (!config.team_id) {
      throw '请在 jwt/config.json 中设置 team_id';
    }

    let privateKey = fs.readFileSync(path.join(appDir, 'jwt/key.txt'));
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

    console.log('👉 参考教程: http://help.jwt.code0xff.com');
  }
}

function printAndroidKeyInfo(gradle) {
  manifest = getManifest();

  let output = require('child_process').execSync(gradle + ' app:signingReport').toString();
  let r;
  if (output.indexOf('Invalid keystore format') > 0) {
    r = output.match(/Error: ([\s\S]+?)\n----------/);
    console.log('签名文件错误: ' + r[1]);
    console.log('问题可能因为创建 app.keystore 时使用的java版本和当前不一致，可更换java版本后再尝试');
    console.log('\n------ 当前java版本 ------');
    return require('child_process').execSync('java -version', { stdio: 'inherit' });
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

function printHelp() {
  console.log(fs.readFileSync(path.join(__dirname, '../doc/help.txt'), 'utf-8'));
}
