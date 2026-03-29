// ===== 在 MainApplication.java 中添加以下代码 =====
// 1. 在 import 区域添加：
import com.mob.verify.MobVerifyPackage;
import com.mob.Mobsdk;

// 2. 在 getPackages() 方法中添加：
new MobVerifyPackage()

// 3. 在 onCreate() 方法中添加（替换为您的 AppKey 和 AppSecret）：
MobSDK.init(this, "3caaf104bc3d4", "dc47854aa32d3e9778e328ef1770fb98");
// ===== 结束 =====
