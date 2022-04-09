/**
 * Author: Yin Qisen <yinqisen@gmail.com>
 * Github: https://github.com/uappkit
 * Copyright(c) 2022
 */

const _ = require('lodash');
const nopt = require('nopt');
const updateNotifier = require('update-notifier');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const pkg = require('../package.json');
const sync = require('./sync');
const { conforms } = require('lodash');
const { exit } = require('process');

const knownOpts = {
  version: Boolean,
  help: Boolean,
};

const shortHands = {
  v: '--version',
  h: '--help',
};

const appDir = process.cwd();
const localLinkManifest = path.join(appDir, 'manifest.json');
const sdkHomeDir = path.join(require('os').homedir(), '.uappsdk');
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

  // command: uapp new
  if (cmd === 'new') {
    let projectName = args.argv.remain[1];
    if (projectName) {
      require('child_process').execSync('vue create -p dcloudio/uni-preset-vue ' + projectName, { stdio: 'inherit' });
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
  let platform = fs.existsSync(path.join(appDir, 'Main/AppDelegate.m')) ? 'ios' : 'android';
  if (fs.existsSync(path.join(appDir, 'Main/AppDelegate.m'))) {
    platform = 'ios';
  } else if (fs.existsSync(path.join(appDir, '/app/build.gradle'))) {
    platform = 'android';
  } else {
    console.log('查看帮助: uapp -h');
    console.log('uapp 命令必须在APP工程模板根目录下运行');
    console.log('├─ android: https://github.com/uappkit/uapp-android');
    console.log('└─ ios: https://github.com/uappkit/uapp-ios');
    return;
  }

  // command: uapp prepare
  if (cmd == 'prepare') {
    manifestFile = path.join(appDir, 'manifest.json');
    manifest = JSON.parse(stripJSONComments(fs.readFileSync(manifestFile, 'utf8')));
    let compiledDir = path.join(
      path.dirname(fs.realpathSync(localLinkManifest)),
      'unpackage/resources/',
      manifest.appid
    );

    let embedAppsDir = path.join(
      appDir,
      platform === 'ios' ? 'Main/Pandora/apps' : 'app/src/main/assets/apps',
      manifest.appid
    );

    fs.existsSync(embedAppsDir) && fs.rmdirSync(embedAppsDir, { recursive: true });
    fs.mkdirSync(embedAppsDir, { recursive: true });
    sync(compiledDir, embedAppsDir);
    console.log(chalk.green('打包APP资源已就绪'));
    return;
  }

  // commands:
  // uapp manifest sync ${webapp}/src/manifest.json
  // uapp manifest info
  if (cmd === 'manifest' && (args.argv.remain[1] === 'sync' || args.argv.remain[1] === 'info')) {
    let manifestFile = args.argv.remain[2] || 'manifest.json';

    // check symlink
    if (manifestFile === 'manifest.json' && fs.lstatSync(localLinkManifest, { throwIfNoEntry: false })) {
      manifestFile = fs.realpathSync(localLinkManifest);
    }

    if (!fs.existsSync(manifestFile)) {
      console.log('找不到: ' + manifestFile);
      console.log('如需测试，可以使用 manifest 模板: ');
      console.log('uapp manifest ' + path.join(sdkHomeDir, 'templates/manifest.json'));
      return;
    }

    let fstats = fs.lstatSync(localLinkManifest, { throwIfNoEntry: false });
    if (fstats) {
      if (fstats.isSymbolicLink()) {
        fs.unlinkSync(localLinkManifest);
      } else {
        let backupName = 'manifest-' + new Date().getTime() + '.json';
        console.log('注意：当前目录不要直接使用 manifest.json 文件, 已更名为: ' + backupName);
        fs.renameSync(localLinkManifest, localLinkManifest.replace('manifest.json', backupName));
        return;
      }
    }

    fs.symlinkSync(manifestFile, localLinkManifest);
    console.log('当前使用 manifest: ' + manifestFile);

    manifest = JSON.parse(stripJSONComments(fs.readFileSync(manifestFile, 'utf8')));
    manifest = _.merge(require(sdkHomeDir + '/templates/manifest.json'), manifest);

    manifest.uapp.name = manifest.uapp[`${platform}.name`] || manifest.uapp.name || manifest.name;
    manifest.uapp.package = manifest.uapp[`${platform}.package`] || manifest.uapp.package;
    manifest.uapp.versionName = manifest.uapp[`${platform}.versionName`] || manifest.versionName;
    manifest.uapp.versionCode = manifest.uapp[`${platform}.versionCode`] || manifest.versionCode;
    manifest.uapp.appkey = manifest.uapp[`${platform}.appkey`];

    console.log();
    console.log('- appid       : ' + manifest.appid);
    console.log('- appName     : ' + manifest.uapp.name);
    console.log('- package     : ' + manifest.uapp.package);
    console.log('- versionName : ' + manifest.uapp.versionName);
    console.log('- versionCode : ' + manifest.uapp.versionCode);
    if (manifest.uapp.appkey) {
      console.log('- appKey      : ' + manifest.uapp.appkey);
    }
    console.log();

    if (args.argv.remain[1] === 'info') {
      return;
    }

    if (platform == 'android') {
      processAndroid();
      return;
    }

    if (platform == 'ios') {
      processIOS();
      return;
    }
  }

  // command: uapp publish debug
  if (cmd === 'publish' && args.argv.remain[1] === 'debug') {
    if (platform === 'ios') {
      // gererate uapp_debug.xcarchive
      require('child_process').execSync(
        'xcodebuild -project uapp.xcodeproj -destination "generic/platform=iOS" -scheme "uapp-dev" -archivePath out/uapp_debug.xcarchive archive',
        { stdio: 'inherit' }
      );

      // generate ipa
      require('child_process').execSync(
        'xcodebuild -exportArchive -archivePath out/uapp_debug.xcarchive -exportPath out -exportOptionsPlist config/export.plist',
        { stdio: 'inherit' }
      );

      sync(
        path.join(appDir, 'out/uapp-dev.ipa'),
        path.join(path.dirname(fs.realpathSync(localLinkManifest)), 'unpackage/debug/ios_debug.ipa')
      );
      return;
    }

    if (platform === 'android') {
      let gradle = require('os').type === 'Windows_NT' ? './gradlew.bat' : './gradlew';
      require('child_process').execSync(gradle + ' assembleDebug', { stdio: 'inherit' });

      sync(
        path.join(appDir, 'app/build/outputs/apk/debug/app-debug.apk'),
        path.join(path.dirname(fs.realpathSync(localLinkManifest)), 'unpackage/debug/android_debug.apk')
      );
      return;
    }
  }

  // command: uapp jwt
  if (cmd === 'jwt') {
    printJWTToken();
    return;
  }

  // command: uapp keygen
  if (cmd === 'keygen') {
    console.log('注意: ');
    console.log('  build.gradle 中密码默认为 123456, 如有修改为其他密码，请对应修改 build.gradle 中的配置');
    console.log('  建议此处密码继续使用 123456, 以减少修改, 且不会存在安全问题' + '\n');

    let keyFile = path.join(appDir, 'app/app.keystore');
    let keyCommand = 'keytool -genkey -alias key0 -keyalg RSA -keysize 2048 -validity 36500 -keystore ' + keyFile;

    require('child_process').execSync(keyCommand, { stdio: 'inherit' });
    return;
  }

  // command: uapp info, uapp info jwt, uapp info key
  if (
    cmd === 'info' &&
    (!args.argv.remain[1] ||
      (platform === 'ios' && args.argv.remain[1] === 'jwt') ||
      (platform === 'android' && args.argv.remain[1] === 'key'))
  ) {
    if (!args.argv.remain[1]) {
      require('child_process').execSync('uapp manifest info', { stdio: 'inherit' });
    }

    if (platform === 'ios') {
      printJWTToken();
      return;
    }

    // for android
    manifest = JSON.parse(stripJSONComments(fs.readFileSync(path.resolve('manifest.json'), 'utf8')));
    let gradle = require('os').type() === 'Windows_NT' ? 'gradlew.bat' : './gradlew';
    let output = require('child_process')
      .execSync(gradle + ' app:signingReport')
      .toString();
    let r = output.match(/Variant: release[\s\S]+?----------/);

    let md5 = r[0].match(/MD5: (.+)/)[1].replace(/:/g, '');
    let sha1 = r[0].match(/SHA1: (.+)/)[1];
    console.log('👇 应用签名 (MD5), 用于微信开放平台:');
    console.log(md5);
    console.log();
    console.log('👇 Android 证书签名 (SHA1), 用于离线打包 Key:');
    console.log(sha1);
    console.log('https://dev.dcloud.net.cn/app/build-config?appid=' + manifest.appid);

    console.log();
    console.log('----------');
    console.log(r[0]);
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
  var files = fs.readdirSync(dir);
  for (var i in files) {
    var name = path.join(dir, files[i]);
    if (fs.statSync(name).isDirectory()) {
      getFiles(name, files_);
    } else {
      files_.push(name);
    }
  }
  return files_;
}

function cleanEmptyFoldersRecursively(folder) {
  var fs = require('fs');
  var path = require('path');

  var isDir = fs.statSync(folder).isDirectory();
  if (!isDir) {
    return;
  }
  var files = fs.readdirSync(folder);
  if (files.length > 0) {
    files.forEach(function (file) {
      var fullPath = path.join(folder, file);
      cleanEmptyFoldersRecursively(fullPath);
    });

    // re-evaluate files; after deleting subfolder
    // we may have parent folder empty now
    files = fs.readdirSync(folder);
  }

  if (files.length == 0) {
    fs.rmdirSync(folder);
    return;
  }
}

function stripJSONComments(data) {
  data = data.replace(new RegExp('\\s+//(.*)', 'g'), '');
  return data.replace(/\/\*(.*?)\*\//gu, '');
}

/*
 * android platform
 */

function processAndroid() {
  let wxEntryActivityFile = 'WXEntryActivity.java';
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

  let templateFile = path.join(sdkHomeDir, 'templates/android/app/wxapi', wxEntryActivityFile);
  // remove WXEntryActivity.java first, then copy
  let sourceDir = path.join(appDir, 'app/src/main/java/');
  getFiles(sourceDir).forEach((file) => {
    if (file.endsWith(wxEntryActivityFile)) {
      fs.unlinkSync(file);
    }
  });

  // cleanup empty folder
  cleanEmptyFoldersRecursively(sourceDir);

  // DONT change content here
  content = `package ${manifest.uapp.package}.wxapi;
import io.dcloud.feature.oauth.weixin.AbsWXCallbackActivity;

public class WXEntryActivity extends AbsWXCallbackActivity {

}
`;
  let replaceFile = path.join(
    appDir,
    'app/src/main/java/',
    manifest.uapp.package.replace(/\./g, '/'),
    'wxapi',
    wxEntryActivityFile
  );

  fs.mkdirSync(path.dirname(replaceFile), { recursive: true });
  fs.writeFileSync(replaceFile, content);

  replaceControlXml(path.join(appDir, 'app/src/debug/assets/data/dcloud_control.xml'));
  replaceControlXml(path.join(appDir, 'app/src/main/assets/data/dcloud_control.xml'));

  let sdkLinkDir = path.join(appDir, 'app/libs');
  if (fs.existsSync(sdkLinkDir)) {
    fs.unlinkSync(sdkLinkDir);
  }
  fs.symlinkSync(path.join(sdkHomeDir, 'android/libs'), sdkLinkDir, 'dir');

  console.log('processAndroid successfully');
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
  if (fs.existsSync(sdkLinkDir)) {
    fs.unlinkSync(sdkLinkDir);
  }
  fs.symlinkSync(path.join(sdkHomeDir, '/ios/SDK'), sdkLinkDir, 'dir');

  // require('child_process').execSync('xcodegen', { stdio: 'inherit' });
  console.log('processIOS successfully');
}

function replaceStoryboard(storyboardFile) {
  let content = fs.readFileSync(storyboardFile, 'utf-8');
  var re = /(text=")(.+?)(".+)(?=uapp-launchscreen-appname)/;
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
      sub: config.client_id,
    };

    const jwt = require('jsonwebtoken');
    let token = jwt.sign(claims, privateKey, { algorithm: 'ES256' }, { header: headers });
    console.log(token);
  } catch (error) {
    console.log('✨解析出错✨, jwt/config.json 内容示例: ');
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

function printHelp() {
  console.log(fs.readFileSync(path.join(__dirname, '../doc/help.txt'), 'utf-8'));
}
