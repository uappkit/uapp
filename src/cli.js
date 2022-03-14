/**
 * Author: Yin Qisen <yinqisen@gmail.com>
 * Github: https://github.com/uappkit
 * Copyright(c) 2022-03-09
 */

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
const sdkHomeDir = path.join(require('os').homedir(), '.uappsdk');
let manifest = '';

module.exports = function (inputArgs) {
  checkForUpdates();

  const args = nopt(knownOpts, shortHands, inputArgs);
  // console.log(args);

  if (args.version) {
    console.log('uapp 当前版本: ' + pkg.version);
    return;
  }

  const cmd = args.argv.remain[0] || 'help';
  if (!cmd || cmd === 'help' || args.help) {
    printHelp();
    return;
  }

  if (cmd === 'sdk') {
    sync(path.resolve(__dirname, '../uappsdk'), sdkHomeDir);
    console.log(chalk.green('------ uappsdk 已安装 ------'));
    return;
  }

  if (cmd === 'manifest') {
    const manifestFile = args.argv.remain[1] ?? 'manifest.json';
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
    manifest = JSON.parse(stripJSONComments(fs.readFileSync(manifestFile, 'utf8')));

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
  let packageName = manifest['app-plus'].package;
  let wxEntryActivityFile = 'WXEntryActivity.java';

  const templateDir = path.join(sdkHomeDir, 'templates/android');
  getFiles(templateDir).forEach((templateFile) => {
    if (templateFile.endsWith('build.gradle')) {
      let content = fs.readFileSync(templateFile, 'utf-8');

      content = content.replace('${package}', packageName);
      content = content.replace('${name}', manifest.name);

      content = content.replace('${DCLOUD_APPKEY}', manifest['app-plus'].distribute.android['dcloud_appkey']);
      content = content.replace('${versionName}', manifest.versionName);
      content = content.replace('${versionCode}', manifest.versionCode);

      content = content.replace('${WX_APPID}', manifest['app-plus'].distribute.sdkConfigs.oauth.weixin.appid);
      content = content.replace('${WX_SECRET}', manifest['app-plus'].distribute.sdkConfigs.oauth.weixin.appsecret);

      // overwrite content
      let replaceFile = templateFile.replace(templateDir, appDir);
      fs.writeFileSync(replaceFile, content);
    }

    if (templateFile.endsWith(wxEntryActivityFile)) {
      // remove WXEntryActivity.java first, then copy
      let sourceDir = path.join(appDir, 'app/src/main/java/');
      getFiles(sourceDir).forEach((file) => {
        if (file.endsWith(wxEntryActivityFile)) {
          fs.unlinkSync(file);
        }
      });

      // cleanup empty folder
      cleanEmptyFoldersRecursively(sourceDir);

      let content = fs.readFileSync(templateFile, 'utf-8');
      content = content.replace('com.code0xff.uapp.wxapi', packageName + '.wxapi');
      let replaceFile = path.join(
        appDir,
        'app/src/main/java/',
        packageName.replace(/\./g, '/'),
        'wxapi',
        wxEntryActivityFile
      );

      fs.mkdirSync(path.dirname(replaceFile), {
        recursive: true,
      });
      fs.writeFileSync(replaceFile, content);
    }
  });

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
  const templateDir = path.join(sdkHomeDir, 'templates/ios');
  getFiles(templateDir).forEach((templateFile) => {
    if (templateFile.endsWith('base.yml')) {
      let content = fs.readFileSync(templateFile, 'utf-8');

      content = content.replace('${package}', manifest['app-plus'].package);
      content = content.replace('${versionName}', manifest.versionName);
      content = content.replace('${versionCode}', manifest.versionCode);

      // overwrite content
      let replaceFile = templateFile.replace(templateDir, appDir);
      fs.writeFileSync(replaceFile, content);
    }
  });

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

  require('child_process').execSync('xcodegen', { stdio: 'inherit' });
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
  let re = /(<key>dcloud_appkey<\/key>\n.+?<string>)(.+?)(<\/string>)/g;
  content = content.replace(re, '$1' + manifest['app-plus'].distribute.ios['dcloud_appkey'] + '$3');

  // replace ios and wexin meanwhile
  re = /(<key>UniversalLinks<\/key>\n.+?<string>)(.+?)(<\/string>)/g;
  content = content.replace(re, '$1' + manifest['app-plus'].distribute.sdkConfigs.oauth.weixin.UniversalLinks + '$3');

  re = /(<key>weixin<\/key>[\s\S]+?appid<\/key>\n.+?<string>)(.+?)(<\/string>)/g;
  content = content.replace(re, '$1' + manifest['app-plus'].distribute.sdkConfigs.oauth.weixin.appid + '$3');

  re = /(<key>weixin<\/key>[\s\S]+?appSecret<\/key>\n.+<string>)(.+?)(<\/string>)/g;
  content = content.replace(re, '$1' + manifest['app-plus'].distribute.sdkConfigs.oauth.weixin.appsecret + '$3');

  re = /(<key>CFBundleDisplayName<\/key>\n.+?<string>)(.+?)(<\/string>)/g;
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
