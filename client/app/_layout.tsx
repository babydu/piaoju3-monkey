import { useEffect } from 'react';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox } from 'react-native';
import Toast from 'react-native-toast-message';
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ColorSchemeProvider } from '@/hooks/useColorScheme';
import { ThemeProvider } from '@/hooks/useTheme';

LogBox.ignoreLogs([
  "TurboModuleRegistry.getEnforcing(...): 'RNMapsAirModule' could not be found",
]);

function AuthGuard({ children }: { children: React.ReactNode }) {
  const rootState = useRootNavigationState();
  const segments = useSegments();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // 1. 待机检测：导航未挂载 或 鉴权正在加载中，直接返回
    if (!rootState?.key || isLoading) return;

    // 2. 路径检测：确认当前不在登录页
    const inLoginRoute = segments.includes('login');

    // 3. 未登录保护：未登录且不在登录页 → 跳转登录页
    if (!isAuthenticated && !inLoginRoute) {
      router.replace('/login');
    }

    // 4. 已登录保护：已登录但在登录页 → 跳转首页
    if (isAuthenticated && inLoginRoute) {
      router.replace('/');
    }
  }, [rootState?.key, isAuthenticated, isLoading, segments]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ColorSchemeProvider>
        <ThemeProvider>
          <AuthGuard>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <StatusBar style="auto" />
              <Stack
                screenOptions={{
                  animation: 'slide_from_right',
                  gestureEnabled: true,
                  gestureDirection: 'horizontal',
                  headerShown: false,
                }}
              >
                <Stack.Screen name="index" options={{ title: "首页" }} />
                <Stack.Screen name="login" options={{ title: "登录" }} />
                <Stack.Screen name="profile" options={{ title: "个人中心" }} />
                <Stack.Screen name="ticket-upload" options={{ title: "上传票据" }} />
                <Stack.Screen name="ticket-detail" options={{ title: "票据详情" }} />
                <Stack.Screen name="ticket-edit" options={{ title: "编辑票据" }} />
                <Stack.Screen name="tags" options={{ title: "标签管理" }} />
                <Stack.Screen name="collections" options={{ title: "合集管理" }} />
                <Stack.Screen name="membership" options={{ title: "会员中心" }} />
                <Stack.Screen name="settings" options={{ title: "设置" }} />
                <Stack.Screen name="privacy-box" options={{ title: "隐私箱" }} />
                <Stack.Screen name="privacy-password" options={{ title: "隐私密码" }} />
                <Stack.Screen name="recycle-bin" options={{ title: "回收站" }} />
                <Stack.Screen name="backup" options={{ title: "数据备份" }} />
                <Stack.Screen name="themes" options={{ title: "主题换肤" }} />
                <Stack.Screen name="help" options={{ title: "帮助与反馈" }} />
                <Stack.Screen name="search" options={{ title: "搜索" }} />
              </Stack>
              <Toast />
            </GestureHandlerRootView>
          </AuthGuard>
        </ThemeProvider>
      </ColorSchemeProvider>
    </AuthProvider>
  );
}
