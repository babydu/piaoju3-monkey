/**
 * Expo Config Plugin for Mob 秒验 SDK
 * 
 * 此插件配置 Android 原生项目以集成 Mob 秒验 SDK
 * 
 * 使用方法：
 * 在 app.config.ts 中添加：
 * plugins: [
 *   [
 *     './plugins/mob-verify',
 *     {
 *       appKey: 'your_app_key',
 *       appSecret: 'your_app_secret',
 *     }
 *   ]
 * ]
 */

import { AndroidConfig, withAppBuildGradle, withSettingsGradle, withDangerousMod } from '@expo/config-plugins';
import type { ConfigPlugin } from '@expo/config-plugins';
import * as fs from 'fs';
import * as path from 'path';

export interface MobVerifyPluginProps {
  appKey: string;
  appSecret: string;
}

/**
 * 修改 settings.gradle 添加 Mob Maven 仓库
 */
const withMobMavenSettings: ConfigPlugin<MobVerifyPluginProps> = (config, props) => {
  return withSettingsGradle(config, (config) => {
    const settingsContent = config.modResults.contents;
    
    // 检查是否已经添加了 Mob Maven
    if (settingsContent.includes('mvn.mob.com')) {
      return config;
    }

    // 添加 Maven 仓库到 repositories
    const mobMaven = `
        maven {
            url "https://mvn.zztfly.com/android"
        }
        maven {
            url "https://mvn.mob.com/android"
        }
`;

    // 在 dependencyResolutionManagement.repositories 中添加
    if (settingsContent.includes('dependencyResolutionManagement')) {
      config.modResults.contents = settingsContent.replace(
        /(dependencyResolutionManagement\s*\{[\s\S]*?repositories\s*\{)/,
        `$1${mobMaven}`
      );
    }

    return config;
  });
};

/**
 * 修改 build.gradle 添加 MobSDK 插件和依赖
 */
const withMobBuildGradle: ConfigPlugin<MobVerifyPluginProps> = (config, props) => {
  return withAppBuildGradle(config, (config) => {
    const buildGradleContent = config.modResults.contents;

    // 添加 MobSDK 插件
    if (!buildGradleContent.includes('com.mob.sdk')) {
      // 在文件开头添加 apply plugin
      config.modResults.contents = `apply plugin: 'com.mob.sdk'\n${buildGradleContent}`;
    }

    // 添加依赖
    const dependencies = `
dependencies {
    implementation "cn.fly.verify:FlyVerify:+@aar"
    // 移动
    implementation "cn.fly.verify.plugins:FlyPlugins-Cmcc:+@aar"
    // 联通
    implementation "cn.fly.verify.plugins:FlyPlugins-Cucc:+@aar"
    // 小沃
    implementation "cn.fly.verify.plugins:FlyPlugins-XW:+@aar"
    // 电信
    implementation "cn.fly.verify.plugins:FlyPlugins-Ctcc:+@aar"
}
`;

    // 如果没有 dependencies 块，添加一个
    if (!buildGradleContent.includes('implementation "cn.fly.verify:FlyVerify')) {
      // 在文件末尾添加依赖（在最后一个 } 之前）
      const lastBraceIndex = config.modResults.contents.lastIndexOf('}');
      config.modResults.contents = 
        config.modResults.contents.slice(0, lastBraceIndex) + 
        dependencies + 
        config.modResults.contents.slice(lastBraceIndex);
    }

    // 添加 MobSDK 配置块
    if (!buildGradleContent.includes('MobSDK {')) {
      const mobSdkConfig = `
MobSDK {
    appKey "${props.appKey}"
    appSecret "${props.appSecret}"
    spEdition "IZNAO"
    SMSSDK {}
}
`;
      config.modResults.contents = config.modResults.contents + mobSdkConfig;
    }

    return config;
  });
};

/**
 * 创建原生模块代码
 */
const withMobNativeModule: ConfigPlugin<MobVerifyPluginProps> = (config, props) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const packageName = AndroidConfig.Package.getPackage(config);
      if (!packageName) {
        throw new Error('Could not find package name in app config');
      }
      const javaPackagePath = packageName.replace(/\./g, '/');
      const javaDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'java', javaPackagePath);

      // 确保目录存在
      fs.mkdirSync(javaDir, { recursive: true });

      // 创建 MobVerifyModule.java
      const moduleCode = `package ${packageName};

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import cn.fly.verify.FlyVerify;
import cn.fly.verify.VerifyCallback;
import cn.fly.verify.model.BaseResult;
import cn.fly.verify.model.VerifyResult;

/**
 * Mob 秒验 React Native 模块
 */
public class MobVerifyModule extends ReactContextBaseJavaModule {
    private static final String TAG = "MobVerifyModule";
    private ReactApplicationContext reactContext;

    public MobVerifyModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "MobVerify";
    }

    /**
     * 预取号 - 提前获取运营商信息
     */
    @ReactMethod
    public void preVerify(final Promise promise) {
        Activity activity = getCurrentActivity();
        if (activity == null) {
            promise.reject("ERROR", "Activity is null");
            return;
        }

        FlyVerify.getInstance().preVerify(activity, new VerifyCallback() {
            @Override
            public void onResult(BaseResult result) {
                WritableMap map = Arguments.createMap();
                map.putBoolean("success", result.getCode() == 1);
                map.putString("message", result.getMsg());
                map.putInt("code", result.getCode());
                
                if (result.getCode() == 1) {
                    promise.resolve(map);
                } else {
                    promise.reject("PRE_VERIFY_FAILED", result.getMsg());
                }
            }
        });
    }

    /**
     * 一键登录 - 拉起授权页并获取 Token
     */
    @ReactMethod
    public void oneClickLogin(final Promise promise) {
        Activity activity = getCurrentActivity();
        if (activity == null) {
            promise.reject("ERROR", "Activity is null");
            return;
        }

        FlyVerify.getInstance().verify(activity, new VerifyCallback() {
            @Override
            public void onResult(BaseResult result) {
                WritableMap map = Arguments.createMap();
                
                if (result.getCode() == 1 && result instanceof VerifyResult) {
                    VerifyResult verifyResult = (VerifyResult) result;
                    map.putBoolean("success", true);
                    map.putString("token", verifyResult.getToken());
                    map.putString("operator", verifyResult.getOperator());
                    promise.resolve(map);
                } else {
                    map.putBoolean("success", false);
                    map.putString("message", result.getMsg());
                    map.putInt("code", result.getCode());
                    promise.resolve(map);
                }
            }
        });
    }

    /**
     * 检查当前网络环境是否支持秒验
     */
    @ReactMethod
    public void isSupportOneClickLogin(final Promise promise) {
        boolean isSupport = FlyVerify.getInstance().isSupportOneClickVerify();
        promise.resolve(isSupport);
    }

    /**
     * 获取当前运营商信息
     */
    @ReactMethod
    public void getOperatorInfo(final Promise promise) {
        WritableMap map = Arguments.createMap();
        // 返回运营商类型信息
        map.putString("operator", FlyVerify.getInstance().getOperatorType());
        promise.resolve(map);
    }
}
`;

      const modulePath = path.join(javaDir, 'MobVerifyModule.java');
      fs.writeFileSync(modulePath, moduleCode);
      Log.log('Created MobVerifyModule.java');

      // 创建 MobVerifyPackage.java
      const packageCode = `package ${packageName};

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Mob 秒验 React Native Package
 */
public class MobVerifyPackage implements ReactPackage {
    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<>();
        modules.add(new MobVerifyModule(reactContext));
        return modules;
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }
}
`;

      const packagePath = path.join(javaDir, 'MobVerifyPackage.java');
      fs.writeFileSync(packagePath, packageCode);
      Log.log('Created MobVerifyPackage.java');

      // 修改 MainApplication.java 添加 Package
      const mainAppPath = path.join(javaDir, 'MainApplication.java');
      if (fs.existsSync(mainAppPath)) {
        let mainAppContent = fs.readFileSync(mainAppPath, 'utf-8');
        
        if (!mainAppContent.includes('MobVerifyPackage')) {
          // 添加 import
          mainAppContent = mainAppContent.replace(
            'import java.util.List;',
            `import java.util.List;\nimport ${packageName}.MobVerifyPackage;`
          );
          
          // 添加 Package
          mainAppContent = mainAppContent.replace(
            'Arrays.<NativeModule>asList(',
            'Arrays.<NativeModule>asList(\n            new MobVerifyPackage(),'
          );
          
          fs.writeFileSync(mainAppPath, mainAppContent);
          Log.log('Updated MainApplication.java');
        }
      }

      return config;
    },
  ]);
};

// 日志工具
const Log = {
  log: (message: string) => console.log(`[MobVerifyPlugin] ${message}`),
};

/**
 * 主插件函数
 */
const mobVerifyPlugin: ConfigPlugin<MobVerifyPluginProps> = (config, props) => {
  if (!props.appKey || !props.appSecret) {
    throw new Error('MobVerifyPlugin requires appKey and appSecret');
  }

  Log.log(`Configuring Mob Verify SDK with appKey: ${props.appKey.substring(0, 8)}...`);

  config = withMobMavenSettings(config, props);
  config = withMobBuildGradle(config, props);
  config = withMobNativeModule(config, props);

  return config;
};

export default mobVerifyPlugin;
