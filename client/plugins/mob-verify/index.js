/**
 * Expo Config Plugin for Mob 秒验 SDK
 * 
 * 此插件配置 Android 原生项目以集成 Mob 秒验 SDK
 * 
 * 注意：此文件运行在 Node.js 环境中（构建时），使用 CommonJS 语法
 */
/* global require, module, __dirname */

const { AndroidConfig, withAppBuildGradle, withSettingsGradle, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * 修改 settings.gradle 添加 Mob Maven 仓库
 */
const withMobMavenRepo = (config) => {
  return withSettingsGradle(config, (config) => {
    const mavenRepo = `
        maven {
            url "https://mvn.mob.com/android"
        }
`;
    
    if (!config.modResults.contents.includes('mvn.mob.com')) {
      // 在 dependencyResolutionManagement.repositories 中添加
      const reposMatch = config.modResults.contents.match(/(dependencyResolutionManagement\s*\{[\s\S]*?repositories\s*\{)/);
      if (reposMatch) {
        config.modResults.contents = config.modResults.contents.replace(
          reposMatch[0],
          reposMatch[0] + mavenRepo
        );
      } else {
        // 如果没有找到 dependencyResolutionManagement，尝试添加到 settings.gradle 末尾
        config.modResults.contents += `
${mavenRepo}
`;
      }
    }
    return config;
  });
};

/**
 * 修改 app/build.gradle 添加 Mob SDK 依赖
 */
const withMobDependencies = (config, props) => {
  return withAppBuildGradle(config, (config) => {
    const dependencies = `
    // Mob 秒验 SDK
    implementation 'com.mob:SecVerify:+'
    implementation 'com.mob:Mobsdk:+'
`;
    
    if (!config.modResults.contents.includes('com.mob:SecVerify')) {
      // 找到 dependencies 块并添加
      const depsMatch = config.modResults.contents.match(/(dependencies\s*\{)/);
      if (depsMatch) {
        config.modResults.contents = config.modResults.contents.replace(
          depsMatch[0],
          depsMatch[0] + dependencies
        );
      }
    }
    return config;
  });
};

/**
 * 创建/修改 MainApplication.java 添加 MobSDK 初始化
 */
const withMobApplication = (config, props) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const { projectRoot } = config.modRequest;
      
      // 创建 MobVerifyPackage.java
      const packageDir = path.join(
        projectRoot,
        'app/src/main/java/com/mob/verify'
      );
      
      fs.mkdirSync(packageDir, { recursive: true });
      
      const packageContent = `package com.mob.verify;

import android.app.Activity;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.module.annotations.ReactModule;

import cn.mob.mobverify.MobVerify;
import cn.mob.mobverify.listener.MobVerifyListener;

/**
 * Mob 秒验 React Native 模块
 */
@ReactModule(name = MobVerifyModule.NAME)
public class MobVerifyModule extends ReactContextBaseJavaModule {
    public static final String NAME = "MobVerifyModule";
    private final ReactApplicationContext reactContext;

    public MobVerifyModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return NAME;
    }

    /**
     * 检查是否支持一键登录
     */
    @ReactMethod
    public void isSupported(Promise promise) {
        boolean supported = MobVerify.isVerifySupport(reactContext);
        promise.resolve(supported);
    }

    /**
     * 预取号
     */
    @ReactMethod
    public void preVerify(final Promise promise) {
        MobVerify.preVerify(reactContext, new MobVerifyListener() {
            @Override
            public void onSuccess(Object o) {
                promise.resolve(true);
            }

            @Override
            public void onFailure(Object o) {
                WritableMap map = Arguments.createMap();
                if (o instanceof WritableMap) {
                    map = (WritableMap) o;
                } else {
                    map.putString("error", o != null ? o.toString() : "预取号失败");
                }
                promise.reject("PRE_VERIFY_FAILED", map.getString("error") != null ? map.getString("error") : "预取号失败");
            }
        });
    }

    /**
     * 一键登录
     */
    @ReactMethod
    public void oneClickLogin(final Promise promise) {
        Activity activity = getCurrentActivity();
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "当前没有活动窗口");
            return;
        }

        MobVerify.verify(activity, new MobVerifyListener() {
            @Override
            public void onSuccess(Object o) {
                WritableMap result = Arguments.createMap();
                if (o instanceof WritableMap) {
                    result = (WritableMap) o;
                } else if (o instanceof String) {
                    result.putString("token", (String) o);
                }
                promise.resolve(result);
            }

            @Override
            public void onFailure(Object o) {
                WritableMap map = Arguments.createMap();
                if (o instanceof WritableMap) {
                    map = (WritableMap) o;
                } else {
                    map.putString("error", o != null ? o.toString() : "一键登录失败");
                }
                promise.reject("ONE_CLICK_FAILED", map.getString("error") != null ? map.getString("error") : "一键登录失败");
            }
        });
    }

    /**
     * 获取运营商信息
     */
    @ReactMethod
    public void getOperatorInfo(Promise promise) {
        WritableMap result = Arguments.createMap();
        try {
            cn.mob.mobverify.model.OperatorInfo info = MobVerify.getOperatorInfo(reactContext);
            if (info != null) {
                result.putString("operator", info.getOperator());
                result.putString("operatorName", info.getOperatorName());
                result.putString("operatorType", info.getOperatorType());
            }
            promise.resolve(result);
        } catch (Exception e) {
            result.putString("error", e.getMessage());
            promise.resolve(result);
        }
    }
}
`;
      
      fs.writeFileSync(path.join(packageDir, 'MobVerifyModule.java'), packageContent, 'utf8');
      
      // 创建 MobVerifyPackage.java
      const packageFileContent = `package com.mob.verify;

import androidx.annotation.NonNull;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.uimanager.ViewManager;
import com.facebook.react.bridge.ReactApplicationContext;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Mob 秒验 React Native Package
 */
public class MobVerifyPackage implements ReactPackage {
    @NonNull
    @Override
    public List<NativeModule> createNativeModules(@NonNull ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<>();
        modules.add(new MobVerifyModule(reactContext));
        return modules;
    }

    @NonNull
    @Override
    public List<ViewManager> createViewManagers(@NonNull ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }
}
`;
      
      fs.writeFileSync(path.join(packageDir, 'MobVerifyPackage.java'), packageFileContent, 'utf8');
      
      // 创建 MainApplication.java 修改片段（用于手动合并）
      const mainAppPatch = `// ===== 在 MainApplication.java 中添加以下代码 =====
// 1. 在 import 区域添加：
import com.mob.verify.MobVerifyPackage;
import com.mob.Mobsdk;

// 2. 在 getPackages() 方法中添加：
new MobVerifyPackage()

// 3. 在 onCreate() 方法中添加（替换为您的 AppKey 和 AppSecret）：
MobSDK.init(this, "${props.appKey}", "${props.appSecret}");
// ===== 结束 =====
`;
      
      fs.writeFileSync(path.join(packageDir, 'README.txt'), mainAppPatch, 'utf8');
      
      return config;
    },
  ]);
};

/**
 * 主插件函数
 */
module.exports = function withMobVerify(config, props = {}) {
  const { appKey, appSecret } = props;
  
  if (!appKey || !appSecret) {
    console.warn('MobVerify: appKey 和 appSecret 未配置，跳过插件');
    return config;
  }
  
  // 添加 Maven 仓库
  config = withMobMavenRepo(config);
  
  // 添加 SDK 依赖
  config = withMobDependencies(config, props);
  
  // 创建原生模块文件
  config = withMobApplication(config, props);
  
  return config;
};
