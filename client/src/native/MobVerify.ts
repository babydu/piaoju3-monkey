/**
 * Mob 秒验 SDK TypeScript 接口定义
 * 
 * 此模块提供秒验功能的 TypeScript 接口
 * 实际功能需要原生模块支持
 * 
 * 重要：秒验功能需要在真机上运行（npx expo run:android），Expo Go 不支持自定义原生模块
 */

import { NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';

// 检查是否在 Expo Go 环境中
const isExpoGo = Constants.appOwnership === 'expo';

// 原生模块接口
interface MobVerifyNativeModule {
  /**
   * 预取号 - 提前获取运营商信息
   * @returns Promise<{success: boolean, message: string, code: number}>
   */
  preVerify(): Promise<{
    success: boolean;
    message: string;
    code: number;
  }>;

  /**
   * 一键登录 - 拉起授权页并获取 Token
   * @returns Promise<{success: boolean, token?: string, operator?: string, message?: string, code?: number}>
   */
  oneClickLogin(): Promise<{
    success: boolean;
    token?: string;
    operator?: string;
    message?: string;
    code?: number;
  }>;

  /**
   * 检查当前网络环境是否支持秒验
   * @returns Promise<boolean>
   */
  isSupportOneClickLogin(): Promise<boolean>;

  /**
   * 获取当前运营商信息
   * @returns Promise<{operator: string}>
   */
  getOperatorInfo(): Promise<{
    operator: string;
  }>;
}

// 秒验结果
export interface VerifyResult {
  success: boolean;
  token?: string;
  operator?: string;
  message?: string;
  errorCode?: number;
}

// 预取号结果
export interface PreVerifyResult {
  success: boolean;
  message: string;
  code: number;
}

// 运营商类型
export type OperatorType = 'CMCC' | 'CUCC' | 'CTCC' | 'UNKNOWN';

// 秒验状态
export type VerifyStatus = 
  | 'idle'           // 空闲
  | 'preVerifying'   // 预取号中
  | 'ready'          // 预取号成功，可以一键登录
  | 'verifying'      // 一键登录中
  | 'success'        // 登录成功
  | 'failed'         // 登录失败
  | 'notSupported';  // 不支持秒验

// 环境信息
export type MobEnvironment = 'native' | 'expo-go' | 'web' | 'ios';

/**
 * Mob 秒验 SDK 封装类
 */
class MobVerifyService {
  private nativeModule: MobVerifyNativeModule | null = null;
  private _isSupported: boolean | null = null;
  private _environment: MobEnvironment = 'native';

  constructor() {
    // 判断运行环境
    if (Platform.OS === 'web') {
      this._environment = 'web';
    } else if (Platform.OS === 'ios') {
      this._environment = 'ios';
    } else if (isExpoGo) {
      this._environment = 'expo-go';
    } else {
      this._environment = 'native';
    }

    // 获取原生模块（仅在原生 Android 环境下可用）
    if (Platform.OS === 'android' && NativeModules.MobVerify) {
      this.nativeModule = NativeModules.MobVerify;
    }
  }

  /**
   * 获取当前运行环境
   */
  getEnvironment(): MobEnvironment {
    return this._environment;
  }

  /**
   * 检查是否支持秒验功能
   */
  async isSupported(): Promise<boolean> {
    if (this._isSupported !== null) {
      return this._isSupported;
    }

    // Expo Go / Web / iOS 不支持秒验
    if (this._environment !== 'native') {
      console.log(`[MobVerify] 当前环境: ${this._environment}，秒验不可用`);
      this._isSupported = false;
      return false;
    }

    if (!this.nativeModule) {
      console.log('[MobVerify] 原生模块未加载，秒验不可用');
      this._isSupported = false;
      return false;
    }

    try {
      this._isSupported = await this.nativeModule.isSupportOneClickLogin();
      return this._isSupported;
    } catch (error) {
      console.error('[MobVerify] 检查支持状态失败:', error);
      this._isSupported = false;
      return false;
    }
  }

  /**
   * 预取号 - 提前获取运营商信息
   * 在用户进入登录页面时调用，可以加快一键登录速度
   */
  async preVerify(): Promise<PreVerifyResult> {
    if (!this.nativeModule) {
      return {
        success: false,
        message: `秒验功能不可用（当前环境: ${this._environment}）`,
        code: -1,
      };
    }

    try {
      const result = await this.nativeModule.preVerify();
      console.log('[MobVerify] 预取号结果:', result);
      return result;
    } catch (error: any) {
      console.error('[MobVerify] 预取号失败:', error);
      return {
        success: false,
        message: error.message || '预取号失败',
        code: -1,
      };
    }
  }

  /**
   * 一键登录
   * 拉起授权页，用户点击后获取 Token
   */
  async oneClickLogin(): Promise<VerifyResult> {
    if (!this.nativeModule) {
      return {
        success: false,
        message: `秒验功能不可用（当前环境: ${this._environment}）`,
      };
    }

    try {
      const result = await this.nativeModule.oneClickLogin();
      console.log('[MobVerify] 一键登录结果:', result);
      
      if (result.success) {
        return {
          success: true,
          token: result.token,
          operator: result.operator,
        };
      } else {
        return {
          success: false,
          message: result.message || '一键登录失败',
          errorCode: result.code,
        };
      }
    } catch (error: any) {
      console.error('[MobVerify] 一键登录失败:', error);
      return {
        success: false,
        message: error.message || '一键登录失败',
      };
    }
  }

  /**
   * 获取当前运营商信息
   */
  async getOperatorInfo(): Promise<{ operator: OperatorType }> {
    if (!this.nativeModule) {
      return { operator: 'UNKNOWN' };
    }

    try {
      const result = await this.nativeModule.getOperatorInfo();
      return {
        operator: result.operator as OperatorType || 'UNKNOWN',
      };
    } catch (error) {
      console.error('[MobVerify] 获取运营商信息失败:', error);
      return { operator: 'UNKNOWN' };
    }
  }

  /**
   * 获取运营商显示名称
   */
  getOperatorName(operator: OperatorType): string {
    switch (operator) {
      case 'CMCC':
        return '中国移动';
      case 'CUCC':
        return '中国联通';
      case 'CTCC':
        return '中国电信';
      default:
        return '未知运营商';
    }
  }

  /**
   * 获取环境说明
   */
  getEnvironmentMessage(): string {
    switch (this._environment) {
      case 'web':
        return 'Web 平台不支持秒验';
      case 'ios':
        return 'iOS 尚未集成秒验 SDK';
      case 'expo-go':
        return 'Expo Go 不支持秒验，请使用真机运行';
      case 'native':
        return this.nativeModule ? '秒验可用' : '原生模块未加载';
      default:
        return '未知环境';
    }
  }
}

// 导出单例
export const mobVerifyService = new MobVerifyService();
