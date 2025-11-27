/**
 * YouTube Data API v3 服务封装
 * 用于获取视频列表、详情和字幕
 */

import { google, youtube_v3 } from 'googleapis';
import type { YouTubeAuthTokens, YouTubeVideoDetails, Caption } from './types';

export class YouTubeService {
  private oauth2Client: any;
  private youtube: youtube_v3.Youtube;

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );
    this.youtube = google.youtube({
      version: 'v3',
      auth: this.oauth2Client
    });
  }

  /**
   * 生成 OAuth URL（用于用户授权）
   * 需要 YouTube readonly、upload 和完整权限
   */
  getAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/youtube.readonly',
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube'
      ],
      prompt: 'consent' // 强制显示同意页面以获取 refresh_token
    });
  }

  /**
   * 交换授权码获取 tokens
   */
  async getTokensFromCode(code: string): Promise<YouTubeAuthTokens> {
    const { tokens } = await this.oauth2Client.getToken(code);
    return tokens as YouTubeAuthTokens;
  }

  /**
   * 设置已有的 tokens
   */
  setCredentials(tokens: YouTubeAuthTokens): void {
    this.oauth2Client.setCredentials(tokens);
  }

  /**
   * 刷新过期的 access token
   */
  async refreshAccessToken(): Promise<YouTubeAuthTokens> {
    const { credentials } = await this.oauth2Client.refreshAccessToken();
    return credentials as YouTubeAuthTokens;
  }

  /**
   * 获取用户上传的视频列表
   */
  async getUserVideos(maxResults: number = 50): Promise<YouTubeVideoDetails[]> {
    // 1. 获取用户的频道信息
    const channelsResponse = await this.youtube.channels.list({
      part: ['contentDetails'],
      mine: true
    });

    const uploadsPlaylistId = channelsResponse.data.items?.[0]
      ?.contentDetails?.relatedPlaylists?.uploads;

    if (!uploadsPlaylistId) {
      throw new Error('No uploads playlist found');
    }

    // 2. 获取播放列表中的视频 ID
    const playlistResponse = await this.youtube.playlistItems.list({
      part: ['snippet'],
      playlistId: uploadsPlaylistId,
      maxResults
    });

    const videoIds = playlistResponse.data.items
      ?.map(item => item.snippet?.resourceId?.videoId)
      .filter(Boolean) as string[];

    if (!videoIds || videoIds.length === 0) {
      return [];
    }

    // 3. 获取视频详情（包括统计数据）
    const videosResponse = await this.youtube.videos.list({
      part: ['snippet', 'contentDetails', 'statistics'],
      id: videoIds
    });

    return this.parseVideoDetails(videosResponse.data.items || []);
  }

  /**
   * 获取单个视频的详情
   */
  async getVideoDetails(videoId: string): Promise<YouTubeVideoDetails> {
    const response = await this.youtube.videos.list({
      part: ['snippet', 'contentDetails', 'statistics'],
      id: [videoId]
    });

    const video = response.data.items?.[0];
    if (!video) {
      throw new Error(`Video ${videoId} not found`);
    }

    return this.parseVideoDetails([video])[0];
  }

  /**
   * 解析视频数据
   */
  private parseVideoDetails(videos: youtube_v3.Schema$Video[]): YouTubeVideoDetails[] {
    return videos.map(video => ({
      id: video.id!,
      title: video.snippet?.title || 'Untitled',
      description: video.snippet?.description || '',
      thumbnail: video.snippet?.thumbnails?.high?.url ||
        video.snippet?.thumbnails?.medium?.url ||
        video.snippet?.thumbnails?.default?.url || '',
      channelTitle: video.snippet?.channelTitle || '',
      publishedAt: video.snippet?.publishedAt || '',
      duration: video.contentDetails?.duration || '',
      viewCount: video.statistics?.viewCount || '0'
    }));
  }

  /**
   * 获取视频的字幕列表
   */
  async getCaptionsList(videoId: string): Promise<Caption[]> {
    try {
      const response = await this.youtube.captions.list({
        part: ['snippet'],
        videoId
      });

      return response.data.items?.map(caption => ({
        id: caption.id!,
        language: caption.snippet?.language || '',
        name: caption.snippet?.name || ''
      })) || [];
    } catch (error: any) {
      // 如果没有字幕权限或字幕不可用，返回空数组
      console.warn(`Could not fetch captions for video ${videoId}:`, error.message);
      return [];
    }
  }

  /**
   * 获取视频字幕文本
   * 注意：YouTube API 的字幕下载需要特殊权限
   * 作为替代方案，我们可以使用第三方库或服务
   */
  async getVideoTranscript(videoId: string): Promise<string> {
    try {
      // 1. 获取字幕列表
      const captions = await this.getCaptionsList(videoId);

      if (captions.length === 0) {
        throw new Error('No captions available for this video');
      }

      // 2. 优先选择英文字幕，否则选第一个
      const englishCaption = captions.find(c => c.language === 'en') || captions[0];

      // 3. 下载字幕
      // 注意：这需要 youtube.force_ssl scope 和特殊权限
      const response = await this.youtube.captions.download({
        id: englishCaption.id,
        tfmt: 'srt' // SubRip 格式
      });

      // 4. 解析 SRT 格式为纯文本
      const transcript = this.parseSRT(response.data as string);
      return transcript;
    } catch (error: any) {
      // 如果无法获取字幕，返回视频描述作为替代
      console.warn(`Could not fetch transcript for video ${videoId}:`, error.message);
      const videoDetails = await this.getVideoDetails(videoId);
      return videoDetails.description;
    }
  }

  /**
   * 解析 SRT 字幕格式为纯文本
   */
  private parseSRT(srtContent: string): string {
    // SRT 格式：
    // 1
    // 00:00:00,000 --> 00:00:02,000
    // 字幕文本

    const lines = srtContent.split('\n');
    const textLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // 跳过序号行和时间轴行
      if (line === '' || /^\d+$/.test(line) || /\d{2}:\d{2}:\d{2}/.test(line)) {
        continue;
      }

      // 添加字幕文本
      textLines.push(line);
    }

    return textLines.join(' ');
  }

  /**
   * 搜索 YouTube 视频（可选功能）
   */
  async searchVideos(query: string, maxResults: number = 10): Promise<YouTubeVideoDetails[]> {
    const searchResponse = await this.youtube.search.list({
      part: ['snippet'],
      q: query,
      type: ['video'],
      maxResults,
      order: 'relevance'
    });

    const videoIds = searchResponse.data.items
      ?.map(item => item.id?.videoId)
      .filter(Boolean) as string[];

    if (!videoIds || videoIds.length === 0) {
      return [];
    }

    // 获取完整的视频详情
    const videosResponse = await this.youtube.videos.list({
      part: ['snippet', 'contentDetails', 'statistics'],
      id: videoIds
    });

    return this.parseVideoDetails(videosResponse.data.items || []);
  }

  /**
   * 获取频道信息
   */
  async getChannelInfo(): Promise<{
    id: string;
    title: string;
    description: string;
    thumbnail: string;
    subscriberCount: string;
  }> {
    const response = await this.youtube.channels.list({
      part: ['snippet', 'statistics'],
      mine: true
    });

    const channel = response.data.items?.[0];
    if (!channel) {
      throw new Error('Channel not found');
    }

    return {
      id: channel.id!,
      title: channel.snippet?.title || '',
      description: channel.snippet?.description || '',
      thumbnail: channel.snippet?.thumbnails?.default?.url || '',
      subscriberCount: channel.statistics?.subscriberCount || '0'
    };
  }
}

/**
 * 辅助函数：创建 YouTube 服务实例
 */
export function createYouTubeService(
  tokens?: YouTubeAuthTokens
): YouTubeService {
  const service = new YouTubeService(
    process.env.YOUTUBE_CLIENT_ID || process.env.NEXT_PUBLIC_YOUTUBE_CLIENT_ID || '',
    process.env.YOUTUBE_CLIENT_SECRET || '',
    process.env.YOUTUBE_REDIRECT_URI || process.env.NEXT_PUBLIC_YOUTUBE_REDIRECT_URI || ''
  );

  if (tokens) {
    service.setCredentials(tokens);
  }

  return service;
}
