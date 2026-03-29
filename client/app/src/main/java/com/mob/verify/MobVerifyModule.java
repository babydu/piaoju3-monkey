package com.mob.verify;

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
