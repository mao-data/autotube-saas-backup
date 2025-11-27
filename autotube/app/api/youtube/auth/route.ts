/**
 * YouTube OAuth 回调处理
 * URL: /api/youtube/auth
 */

import { NextRequest, NextResponse } from 'next/server';
import { createYouTubeService } from '@/lib/youtube-api';
import { doc, setDoc } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // state 包含 userId
  const error = searchParams.get('error');

  // 检查是否有错误
  if (error) {
    console.error('YouTube OAuth error:', error);
    return NextResponse.redirect(
      new URL(`/?error=youtube_auth_failed&message=${error}`, request.url)
    );
  }

  // 检查必需参数
  if (!code || !state) {
    return NextResponse.json(
      { error: 'Missing code or state parameter' },
      { status: 400 }
    );
  }

  try {
    // 创建 YouTube 服务实例
    const youtubeService = createYouTubeService();

    // 交换授权码获取 tokens
    const tokens = await youtubeService.getTokensFromCode(code);

    // 保存 tokens 到 Firestore
    const db = getFirebaseDb();
    await setDoc(doc(db, 'youtubeAuth', state), {
      userId: state,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date,
      updatedAt: new Date().toISOString()
    });

    // 重定向到 dashboard 并显示成功消息
    return NextResponse.redirect(
      new URL('/?youtube=connected', request.url)
    );
  } catch (error: any) {
    console.error('YouTube auth error:', error);
    return NextResponse.redirect(
      new URL(`/?error=youtube_auth_failed&message=${encodeURIComponent(error.message)}`, request.url)
    );
  }
}
