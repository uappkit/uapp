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

  const cmd = args.argv.remain[0] || 'help';
  if (!cmd || cmd === 'help' || args.help) {
    printHelp();
    return;
  }

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

  if (cmd === 'sdk' && args.argv.remain[1] === 'init') {
    sync(path.resolve(__dirname, '../uappsdk'), sdkHomeDir);
    console.log(chalk.green('------ uappsdk 已安装 ------'));
    return;
  }

  if (cmd == 'prepare') {
    manifestFile = path.join(appDir, 'manifest.json');
    manifest = JSON.parse(stripJSONComments(fs.readFileSync(manifestFile, 'utf8')));
    let compiledDir = path.join(
      path.dirname(fs.realpathSync(localLinkManifest)),
      'unpackage/resources/',
      manifest['appid']
    );

    let embedAppsDir = path.join(
      appDir,
      platform === 'ios' ? 'Main/Pandora/apps' : 'app/src/main/assets/apps',
      manifest['appid']
    );

    fs.existsSync(embedAppsDir) && fs.rmdirSync(embedAppsDir, { recursive: true });
    fs.mkdirSync(embedAppsDir, { recursive: true });
    sync(compiledDir, embedAppsDir);
    console.log(chalk.green('打包APP资源已就绪'));
    return;
  }

  if (cmd === 'manifest') {
    let manifestFile = args.argv.remain[1] || 'manifest.json';

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

    if (!fs.existsSync(manifestFile)) {
      console.log('无法找到 manifest.json: ' + manifestFile);
      return;
    }

    console.log('当前使用 manifest: ' + manifestFile);

    fs.lstatSync(localLinkManifest, { throwIfNoEntry: false }) && fs.unlinkSync(localLinkManifest);
    fs.symlinkSync(manifestFile, localLinkManifest);
    manifest = JSON.parse(stripJSONComments(fs.readFileSync(manifestFile, 'utf8')));
    manifest = _.merge(require(sdkHomeDir + '/templates/manifest.json'), manifest);

    if (platform == 'android') {
      processAndroid();
      return;
    }

    if (platform == 'ios') {
      processIOS();
      return;
    }
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
  let packageName = manifest['uapp']['android.package'] || manifest['uapp']['package'];
  let wxEntryActivityFile = 'WXEntryActivity.java';

  let baseGradleFile = path.join(appDir, 'app/build.gradle');
  let content = fs.readFileSync(baseGradleFile, 'utf-8');

  content = content.replace(/(applicationId ")(.*)(")/, '$1' + packageName + '$3');
  content = content.replace(
    /('app_name',\w+")(.*)(")/,
    '$1' + (manifest['uapp']['android.name'] || manifest['uapp']['name'] || manifest.name) + '$3'
  );

  content = content.replace(
    /(versionCode )(.*$)/,
    '$1' + (manifest['uapp']['android.versionCode'] || manifest.versionCode)
  );

  content = content.replace(
    /(versionName\w+")(.*)("$)/,
    '$1' + (manifest['uapp']['android.versionName'] || manifest.versionName)
  );

  content = content.replace(
    /('app_name',\w+")(.*)(")/,
    '$1' + (manifest['uapp']['android.name'] || manifest['uapp']['name'] || manifest.name) + '$3'
  );

  content = content.replace(
    /("DCLOUD_APPKEY"\w+:\w+")(.*)(",)/,
    '$1' + (manifest['uapp']['ios.package'] || manifest['uapp']['package']) + '$3'
  );

  content = content.replace(
    /("DCLOUD_APPKEY"\w+:\w+")(.*)(",)/,
    '$1' + (manifest['uapp']['ios.package'] || manifest['uapp']['package']) + '$3'
  );

  content = content.replace(
    /("WX_APPID"\w+:\w+")(.*)(",)/,
    '$1' + manifest['app-plus'].distribute.sdkConfigs.oauth.weixin.appid + '$3'
  );

  content = content.replace(
    /("WX_SECRET"\w+:\w+")(.*)(",)/,
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
  content = `package ${packageName}.wxapi;
import io.dcloud.feature.oauth.weixin.AbsWXCallbackActivity;

public class WXEntryActivity extends AbsWXCallbackActivity {

}
`;
  let replaceFile = path.join(
    appDir,
    'app/src/main/java/',
    packageName.replace(/\./g, '/'),
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

  content = content.replace(
    /(PRODUCT_BUNDLE_IDENTIFIER: )(.*$)/,
    '$1' + (manifest['uapp']['ios.package'] || manifest['uapp']['package'])
  );

  content = content.replace(
    /(MARKETING_VERSION: )(.*$)/,
    '$1' + (manifest['uapp']['ios.versionName'] || manifest.versionName)
  );

  content = content.replace(
    /(CURRENT_PROJECT_VERSION: )(.*$)/,
    '$1' + (manifest['uapp']['ios.versionCode'] || manifest.versionCode)
  );
  fs.writeFileSync(baseYamlFile, content);

  // update name
  manifest['name'] = manifest['uapp']['ios.name'] || manifest['uapp']['name'] || manifest['name'];

  replaceStoryboard(path.join(appDir, 'Main/Resources/LaunchScreen.storyboard'));
  replaceStoryboard(path.join(appDir, 'Main/Resources/LaunchScreenAD.storyboard'));

  replaceInfoPlist(path.join(appDir, 'Main/Resources/AppDev/Info.plist'));
  replaceInfoPlist(path.join(appDir, 'Main/Resources/AppRelease/Info.plist'));

  replaceControlXml(path.join(appDir, 'Main/Resources/AppDev/control.xml'));
  replaceControlXml(path.join(appDir, 'Main/Resources/AppRelease/control.xml'));

  let sdkLinkDir = path.join(appDir, '/../SDK');
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
  content = content.replace(re, '$1' + manifest.name + '$3');
  fs.writeFileSync(storyboardFile, content);
}

function replaceInfoPlist(plistFile) {
  let content = fs.readFileSync(plistFile, 'utf-8');
  let re = /(<key>dcloud_appkey<\/key>\n.+?<string>)(.*?)(<\/string>)/g;
  content = content.replace(re, '$1' + manifest['uapp']['ios.appkey'] + '$3');

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

  content = content.replace(re, '$1' + manifest.name + '$3');
  fs.writeFileSync(plistFile, content);
}

function replaceControlXml(xmlFile) {
  let content = fs.readFileSync(xmlFile, 'utf-8');
  let re = /(app appid=")(.+?)(")/g;
  content = content.replace(re, '$1' + manifest.appid + '$3');
  fs.writeFileSync(xmlFile, content);
}

function printHelp() {
  console.log(fs.readFileSync(path.join(__dirname, '../doc/help.txt'), 'utf-8'));
}
