/**
 * YouTube 视频列表 API
 * URL: /api/youtube/videos
 */

import { NextRequest, NextResponse } from 'next/server';
import { createYouTubeService } from '@/lib/youtube-api';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import type { YouTubeAuthTokens } from '@/lib/types';

export async function GET(request: NextRequest) {
  // 从 headers 获取用户 ID
  const userId = request.headers.get('x-user-id');

  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized - Missing user ID' },
      { status: 401 }
    );
  }

  try {
    const db = getFirebaseDb();

    // 从 Firestore 获取 YouTube tokens
    const authDoc = await getDoc(doc(db, 'youtubeAuth', userId));

    if (!authDoc.exists()) {
      return NextResponse.json(
        { error: 'YouTube not connected', needsAuth: true },
        { status: 403 }
      );
    }

    const authData = authDoc.data();
    let tokens: YouTubeAuthTokens = {
      access_token: authData.accessToken,
      refresh_token: authData.refreshToken,
      expiry_date: authData.expiryDate
    };

    // 创建 YouTube 服务实例
    const youtubeService = createYouTubeService(tokens);

    // 检查 token 是否过期，如果过期则刷新
    const now = Date.now();
    if (tokens.expiry_date && tokens.expiry_date < now) {
      try {
        // 刷新 token
        tokens = await youtubeService.refreshAccessToken();

        // 保存新的 tokens 到 Firestore
        await setDoc(doc(db, 'youtubeAuth', userId), {
          userId,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiryDate: tokens.expiry_date,
          updatedAt: new Date().toISOString()
        });

        // 更新服务实例的 credentials
        youtubeService.setCredentials(tokens);
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        return NextResponse.json(
          { error: 'Token refresh failed', needsAuth: true },
          { status: 401 }
        );
      }
    }

    // 获取视频列表
    const videos = await youtubeService.getUserVideos(50);

    return NextResponse.json({
      success: true,
      videos,
      count: videos.length
    });
  } catch (error: any) {
    console.error('Failed to fetch videos:', error);

    // 检查是否是认证错误
    if (error.code === 401 || error.code === 403) {
      return NextResponse.json(
        { error: 'Authentication failed', needsAuth: true, message: error.message },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch videos', message: error.message },
      { status: 500 }
    );
  }
}
