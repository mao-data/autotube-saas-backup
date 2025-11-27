/**
 * 共享类型定义
 */

// 用户配置
export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  credits: number;
  isDemo?: boolean;
}

// YouTube 视频（用于展示）
export interface YouTubeVideo {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  description: string;
}

// 生成的内容
export interface GeneratedContent {
  id: string;
  type: 'text' | 'video_blueprint';
  sourceVideoId: string;
  sourceTitle: string;
  content: string | VideoBlueprint;
  createdAt: any;
  status: 'draft' | 'scheduled' | 'published';
  scheduledDate?: any;
}

// YouTube 认证数据
export interface YouTubeAuthTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

export interface YouTubeAuthData {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiryDate: number;
}

// YouTube 视频详情
export interface YouTubeVideoDetails {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  duration: string;
  viewCount: string;
}

// YouTube 字幕
export interface Caption {
  id: string;
  language: string;
  name: string;
}

// Sora 任务
export interface SoraTask {
  id: string;
  userId: string;
  analysisId: string;
  prompt: string;
  duration: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  soraTaskId?: string;
  videoUrl?: string;
  errorMessage?: string;
  createdAt: any;
  completedAt?: any;
  retryCount?: number;
}

// 视频分析结果
export interface VideoAnalysisResult {
  summary: string;
  key_moments: Array<{
    timestamp: string;
    description: string;
    emotional_tone: string;
  }>;
  sora_prompts: Array<{
    scene_number: number;
    duration: string;
    prompt: string;
    style_tags: string[];
  }>;
  metadata: {
    suggested_title: string;
    suggested_description: string;
    suggested_tags: string[];
    category: string;
  };
}

// 视频分析记录
export interface VideoAnalysis {
  userId: string;
  videoId: string;
  sourceTitle: string;
  analysis: VideoAnalysisResult;
  createdAt: any;
}

// 扩展的生成内容（与现有 GeneratedContent 兼容）
export interface ExtendedGeneratedContent {
  id: string;
  type: 'text' | 'video_blueprint' | 'video_generated';
  sourceVideoId: string;
  sourceTitle: string;
  content: string | VideoBlueprint;
  createdAt: any;
  status: 'draft' | 'scheduled' | 'published' | 'generating' | 'failed';
  scheduledDate?: any;

  // 新增字段
  soraTaskId?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  youtubeVideoId?: string;
  errorMessage?: string;
  publishStatus?: 'draft' | 'scheduled' | 'published' | 'failed';
  publishedAt?: any;
}

// 视频蓝图
export interface VideoBlueprint {
  video_title: string;
  script_sections: ScriptSection[];
  sora_prompts?: string[];
  estimated_duration?: number;
}

export interface ScriptSection {
  timestamp: string;
  voiceover: string;
  visual_prompt: string;
}

// YouTube 上传选项
export interface YouTubeUploadOptions {
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  privacyStatus: 'private' | 'public' | 'unlisted';
  publishAt?: Date;
}
