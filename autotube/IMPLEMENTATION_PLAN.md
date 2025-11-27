# AutoTube AI 视频自动化工作流实施计划

## 📋 项目概述

实现完整的 AI 驱动视频自动化管道：
**YouTube 视频 → Gemini 分析 → Sora 2 生成 → YouTube 自动发布**

### 核心技术栈（基于用户选择）
- **后端**: Firebase Cloud Functions (无服务器)
- **视频分析**: Gemini 2.5 Flash + YouTube 字幕 API
- **视频生成**: Sora 2 API
- **任务管理**: Google Cloud Tasks (任务队列)
- **状态追踪**: 前端轮询 Firestore

---

## 🎯 实施阶段

### 阶段 1: YouTube API 集成 (3-4天)

#### 目标
替换 MOCK_VIDEOS，实现真实的 YouTube 视频获取和 OAuth 授权。

#### 新建文件

**1. `/autotube/app/lib/youtube-api.ts`**
```typescript
// YouTube Data API v3 服务封装
export class YouTubeService {
  // OAuth2 认证流程
  getAuthUrl(): string
  getTokensFromCode(code: string): Promise<YouTubeAuthTokens>

  // 视频列表和详情
  getUserVideos(maxResults: number): Promise<YouTubeVideoDetails[]>
  getVideoDetails(videoId: string): Promise<YouTubeVideoDetails>

  // 字幕获取（关键！）
  getVideoTranscript(videoId: string): Promise<string>
  getCaptionsList(videoId: string): Promise<Caption[]>
}
```

**2. `/autotube/app/api/youtube/auth/route.ts`**
```typescript
// OAuth 回调处理
export async function GET(request: NextRequest) {
  // 1. 接收 code 和 state
  // 2. 交换 access_token 和 refresh_token
  // 3. 保存到 Firestore: youtubeAuth/{userId}
  // 4. 重定向到 dashboard
}
```

**3. `/autotube/app/api/youtube/videos/route.ts`**
```typescript
// 获取用户视频列表
export async function GET(request: NextRequest) {
  // 1. 验证用户身份
  // 2. 从 Firestore 获取 YouTube tokens
  // 3. 调用 YouTube API 获取视频列表
  // 4. 返回视频数据
}
```

#### 修改文件

**`/autotube/app/components/AutoTubeApp.tsx`**

Line 286 - 修改 `login()` 函数：
```typescript
const login = async () => {
  // 添加 YouTube scopes
  provider.addScope('https://www.googleapis.com/auth/youtube.readonly');
  provider.addScope('https://www.googleapis.com/auth/youtube.upload');
  provider.addScope('https://www.googleapis.com/auth/youtube');

  const result = await signInWithPopup(authRef.current, provider);

  // 保存 YouTube tokens
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (credential?.accessToken) {
    await saveYouTubeTokens(user.uid, credential.accessToken);
  }
};
```

Line 172 - 替换 MOCK_VIDEOS：
```typescript
const [videos, setVideos] = useState<YouTubeVideo[]>([]);
const [isLoadingVideos, setIsLoadingVideos] = useState(false);

useEffect(() => {
  if (user && !user.isDemo) {
    fetchYouTubeVideos();
  } else {
    setVideos(MOCK_VIDEOS);
  }
}, [user]);

const fetchYouTubeVideos = async () => {
  setIsLoadingVideos(true);
  const response = await fetch('/api/youtube/videos', {
    headers: { 'x-user-id': user!.uid }
  });
  const data = await response.json();
  setVideos(data.videos);
  setIsLoadingVideos(false);
};
```

#### 环境变量

`.env.local` 新增：
```bash
# YouTube API
YOUTUBE_CLIENT_ID=your_client_id
YOUTUBE_CLIENT_SECRET=your_client_secret
YOUTUBE_REDIRECT_URI=http://localhost:8080/api/youtube/auth
YOUTUBE_API_KEY=your_api_key
```

#### 测试验证
- [ ] OAuth 流程成功
- [ ] 获取真实视频列表
- [ ] 字幕 API 正常工作
- [ ] Token 刷新机制

---

### 阶段 2: Gemini 字幕分析 + Sora 提示词生成 (4-5天)

#### 目标
使用 Gemini 分析 YouTube 视频字幕和元数据，生成高质量的 Sora 2 提示词。

#### 新建文件

**1. `/autotube/app/lib/gemini-transcript-analyzer.ts`**
```typescript
/**
 * 基于字幕的视频分析服务
 * 优势：无需下载视频，成本低，速度快
 */
export class GeminiTranscriptAnalyzer {
  constructor(apiKey: string)

  async analyzeForSora(params: {
    videoId: string;
    title: string;
    description: string;
    transcript: string;
    duration: string;
  }): Promise<VideoAnalysisResult>
}

interface VideoAnalysisResult {
  summary: string;
  key_moments: Array<{
    timestamp: string;
    description: string;
    emotional_tone: string;
  }>;
  sora_prompts: Array<{
    scene_number: number;
    duration: string;
    prompt: string;        // Sora 2 专业提示词
    style_tags: string[];
  }>;
  metadata: {
    suggested_title: string;
    suggested_description: string;
    suggested_tags: string[];
    category: string;
  };
}
```

**2. `/autotube/functions/package.json`**
```json
{
  "name": "autotube-functions",
  "engines": { "node": "20" },
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^5.0.0",
    "@google/genai": "^1.30.0",
    "googleapis": "^140.0.0"
  }
}
```

**3. `/autotube/functions/src/index.ts`**

主要函数：
```typescript
/**
 * Cloud Function: 分析 YouTube 视频字幕并生成 Sora 提示词
 */
export const analyzeVideoForSora = functions
  .runWith({ timeoutSeconds: 300, memory: '1GB' })
  .https.onCall(async (data, context) => {
    const { videoId, sourceTitle } = data;
    const userId = context.auth!.uid;

    // 1. 获取 YouTube tokens
    const authData = await getYouTubeAuth(userId);

    // 2. 获取视频详情和字幕
    const youtubeService = new YouTubeService(authData);
    const videoDetails = await youtubeService.getVideoDetails(videoId);
    const transcript = await youtubeService.getVideoTranscript(videoId);

    // 3. 使用 Gemini 分析
    const analyzer = new GeminiTranscriptAnalyzer(
      functions.config().gemini.api_key
    );
    const analysis = await analyzer.analyzeForSora({
      videoId,
      title: videoDetails.title,
      description: videoDetails.description,
      transcript,
      duration: videoDetails.duration
    });

    // 4. 保存到 Firestore
    const analysisRef = await admin.firestore()
      .collection('videoAnalyses')
      .add({
        userId,
        videoId,
        sourceTitle,
        analysis,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

    return { success: true, analysisId: analysisRef.id, analysis };
  });
```

#### Gemini Prompt 设计

```typescript
const prompt = `
你是一位专业的视频创意分析师和 Sora AI 提示词专家。

任务：基于 YouTube 视频的元数据和字幕，为 Sora 2 创建高质量的视频生成提示词。

源视频信息：
- 标题：${title}
- 描述：${description}
- 时长：${duration}
- 字幕内容：
${transcript}

要求：
1. 分析视频的核心内容、主题、情感基调
2. 识别 3-5 个适合重新创作的关键场景
3. 为每个场景生成精确的 Sora 2 提示词，包含：
   - 视觉描述（镜头角度、光线、色彩、构图）
   - 动作和运动（相机运动、主体动作）
   - 风格和氛围（电影感、艺术风格）
   - 技术细节（景深、帧率感觉、质感）
4. 生成适合 YouTube 的新视频元数据

Sora 提示词示例：
"A cinematic tracking shot through a bustling Tokyo street at night.
Neon signs glow in vibrant purples and blues, reflecting off wet pavement.
A young woman in a flowing coat walks confidently through the crowd.
Camera smoothly follows her from behind, shallow depth of field,
35mm film aesthetic, moody and atmospheric. 4K quality."

返回 JSON 格式。
`;
```

#### 测试验证
- [ ] 字幕获取成功
- [ ] Gemini 分析返回结构化数据
- [ ] Sora 提示词符合最佳实践
- [ ] Cloud Function 在 5 分钟内完成

---

### 阶段 3: Sora 2 视频生成 + 任务队列 (4-5天)

#### 目标
集成 Sora 2 API，使用 Cloud Tasks 管理批量生成任务。

#### 新建文件

**1. `/autotube/functions/src/services/sora.ts`**
```typescript
export class SoraService {
  constructor(apiKey: string, baseUrl: string)

  // 提交视频生成任务
  async generateVideo(request: {
    prompt: string;
    duration: string;  // "5s", "10s", "30s", "60s"
    aspect_ratio: '16:9' | '9:16' | '1:1';
    quality: 'draft' | 'standard' | 'high';
  }): Promise<{ taskId: string }>

  // 查询任务状态
  async getTaskStatus(taskId: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
    videoUrl?: string;
    error?: string;
  }>

  // 取消任务
  async cancelTask(taskId: string): Promise<void>
}
```

**2. `/autotube/functions/src/index.ts` - 新增函数**

```typescript
/**
 * Cloud Function: 触发 Sora 视频生成
 */
export const generateVideoWithSora = functions
  .runWith({ timeoutSeconds: 300, memory: '1GB' })
  .https.onCall(async (data, context) => {
    const { analysisId, selectedPromptIndex } = data;
    const userId = context.auth!.uid;

    // 1. 获取分析结果
    const analysisDoc = await admin.firestore()
      .doc(`videoAnalyses/${analysisId}`)
      .get();
    const analysis = analysisDoc.data()!.analysis;
    const selectedPrompt = analysis.sora_prompts[selectedPromptIndex];

    // 2. 创建 Sora 任务记录
    const taskRef = await admin.firestore()
      .collection('soraTasks')
      .add({
        userId,
        analysisId,
        prompt: selectedPrompt.prompt,
        duration: selectedPrompt.duration,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

    // 3. 提交到 Cloud Tasks（异步处理）
    await createSoraTask(taskRef.id, selectedPrompt);

    return { success: true, taskId: taskRef.id };
  });

/**
 * Cloud Tasks 处理器：执行 Sora 生成
 */
export const processSoraTask = functions
  .runWith({ timeoutSeconds: 540, memory: '2GB' })
  .https.onRequest(async (req, res) => {
    const { taskId } = req.body;

    try {
      const taskDoc = await admin.firestore()
        .doc(`soraTasks/${taskId}`)
        .get();
      const taskData = taskDoc.data()!;

      // 更新状态为 processing
      await taskDoc.ref.update({ status: 'processing' });

      // 调用 Sora API
      const soraService = new SoraService(
        functions.config().sora.api_key
      );
      const soraResponse = await soraService.generateVideo({
        prompt: taskData.prompt,
        duration: taskData.duration,
        aspect_ratio: '16:9',
        quality: 'high'
      });

      // 保存 Sora 任务 ID
      await taskDoc.ref.update({
        soraTaskId: soraResponse.taskId,
        status: 'processing'
      });

      res.status(200).send({ success: true });
    } catch (error) {
      console.error('Sora task failed:', error);
      await admin.firestore().doc(`soraTasks/${taskId}`).update({
        status: 'failed',
        errorMessage: error.message
      });
      res.status(500).send({ error: error.message });
    }
  });

/**
 * 定时任务：检查 Sora 生成状态
 */
export const checkSoraTasks = functions.pubsub
  .schedule('every 2 minutes')
  .onRun(async (context) => {
    const tasks = await admin.firestore()
      .collection('soraTasks')
      .where('status', '==', 'processing')
      .where('soraTaskId', '!=', null)
      .limit(100)
      .get();

    const soraService = new SoraService(
      functions.config().sora.api_key
    );

    for (const taskDoc of tasks.docs) {
      const taskData = taskDoc.data();

      try {
        const soraStatus = await soraService.getTaskStatus(
          taskData.soraTaskId
        );

        if (soraStatus.status === 'completed') {
          // 下载视频并上传到 Firebase Storage
          const videoBlob = await fetch(soraStatus.videoUrl)
            .then(r => r.blob());

          const storagePath =
            `generated-videos/${taskData.userId}/${taskDoc.id}.mp4`;
          const bucket = admin.storage().bucket();
          const file = bucket.file(storagePath);

          await file.save(Buffer.from(await videoBlob.arrayBuffer()), {
            contentType: 'video/mp4'
          });

          const [downloadUrl] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 365 * 24 * 60 * 60 * 1000
          });

          // 更新任务状态
          await taskDoc.ref.update({
            status: 'completed',
            videoUrl: downloadUrl,
            completedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          // 扣除 Credits
          await admin.firestore()
            .doc(`users/${taskData.userId}`)
            .update({
              credits: admin.firestore.FieldValue.increment(-50)
            });
        } else if (soraStatus.status === 'failed') {
          await taskDoc.ref.update({
            status: 'failed',
            errorMessage: soraStatus.error
          });
        }
      } catch (error) {
        console.error(`Check task ${taskDoc.id} failed:`, error);
      }
    }
  });
```

**3. Cloud Tasks 创建辅助函数**

```typescript
import { CloudTasksClient } from '@google-cloud/tasks';

async function createSoraTask(taskId: string, promptData: any) {
  const client = new CloudTasksClient();
  const project = process.env.GCLOUD_PROJECT;
  const location = 'us-central1';
  const queue = 'sora-generation-queue';

  const parent = client.queuePath(project, location, queue);

  const task = {
    httpRequest: {
      httpMethod: 'POST',
      url: `https://${location}-${project}.cloudfunctions.net/processSoraTask`,
      headers: { 'Content-Type': 'application/json' },
      body: Buffer.from(JSON.stringify({ taskId })).toString('base64')
    }
  };

  await client.createTask({ parent, task });
}
```

#### 前端轮询实现

**`/autotube/app/components/AutoTubeApp.tsx`** - 新增函数：

```typescript
// 轮询 Sora 任务状态
const pollSoraTaskStatus = (taskId: string) => {
  const interval = setInterval(async () => {
    try {
      const taskDoc = await getDoc(
        doc(dbRef.current, 'soraTasks', taskId)
      );

      if (!taskDoc.exists()) return;
      const taskData = taskDoc.data();

      if (taskData.status === 'completed') {
        clearInterval(interval);
        showToast("Video generated successfully!", "success");
        fetchAssets(user!.uid);
      } else if (taskData.status === 'failed') {
        clearInterval(interval);
        showToast(
          `Generation failed: ${taskData.errorMessage}`,
          "error"
        );
      }
    } catch (error) {
      console.error('Poll failed:', error);
    }
  }, 10000); // 每 10 秒检查一次

  // 10 分钟后停止
  setTimeout(() => clearInterval(interval), 600000);
};
```

#### 数据模型扩展

**Firestore Collections:**

```typescript
// soraTasks/{taskId}
interface SoraTask {
  userId: string;
  analysisId: string;
  prompt: string;
  duration: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  soraTaskId?: string;
  videoUrl?: string;
  errorMessage?: string;
  createdAt: Timestamp;
  completedAt?: Timestamp;
  retryCount?: number;
}

// videoAnalyses/{analysisId}
interface VideoAnalysis {
  userId: string;
  videoId: string;
  sourceTitle: string;
  analysis: VideoAnalysisResult;
  createdAt: Timestamp;
}
```

#### 测试验证
- [ ] Sora API 调用成功
- [ ] Cloud Tasks 任务创建
- [ ] 定时检查任务状态
- [ ] 视频保存到 Storage
- [ ] 前端轮询正常更新

---

### 阶段 4: YouTube 自动发布 (4-5天)

#### 目标
自动上传生成的视频到 YouTube，包括元数据生成和定时发布。

#### 新建文件

**1. `/autotube/app/lib/youtube-upload.ts`**
```typescript
export class YouTubeUploadService {
  constructor(clientId: string, clientSecret: string, redirectUri: string)

  setCredentials(tokens: YouTubeAuthTokens): void

  // 上传视频到 YouTube
  async uploadVideo(
    videoBuffer: Buffer,
    options: {
      title: string;
      description: string;
      tags: string[];
      categoryId: string;
      privacyStatus: 'private' | 'public' | 'unlisted';
      publishAt?: Date;
    }
  ): Promise<string> // 返回 YouTube 视频 ID

  // 上传缩略图
  async uploadThumbnail(
    videoId: string,
    thumbnailBuffer: Buffer
  ): Promise<void>

  // 更新视频状态（用于定时发布）
  async updateVideoStatus(
    videoId: string,
    privacyStatus: string
  ): Promise<void>
}
```

**2. `/autotube/functions/src/index.ts` - 发布函数**

```typescript
/**
 * Cloud Function: 发布视频到 YouTube
 */
export const publishToYouTube = functions
  .runWith({ timeoutSeconds: 540, memory: '2GB' })
  .https.onCall(async (data, context) => {
    const { taskId, scheduledDate } = data;
    const userId = context.auth!.uid;

    try {
      // 1. 获取生成的视频
      const taskDoc = await admin.firestore()
        .doc(`soraTasks/${taskId}`)
        .get();
      const taskData = taskDoc.data()!;

      if (taskData.status !== 'completed') {
        throw new Error('Video not ready');
      }

      // 2. 获取分析数据（元数据）
      const analysisDoc = await admin.firestore()
        .doc(`videoAnalyses/${taskData.analysisId}`)
        .get();
      const analysis = analysisDoc.data()!.analysis;

      // 3. 下载视频文件
      const bucket = admin.storage().bucket();
      const videoFile = bucket.file(
        taskData.videoUrl.split('/').pop()
      );
      const [videoBuffer] = await videoFile.download();

      // 4. 生成缩略图（使用 Gemini Imagen）
      const thumbnailBuffer = await generateThumbnail(
        analysis.metadata.suggested_title
      );

      // 5. 上传到 YouTube
      const authData = await getYouTubeAuth(userId);
      const uploadService = new YouTubeUploadService(
        functions.config().youtube.client_id,
        functions.config().youtube.client_secret,
        functions.config().youtube.redirect_uri
      );
      uploadService.setCredentials(authData);

      const youtubeVideoId = await uploadService.uploadVideo(
        videoBuffer,
        {
          title: analysis.metadata.suggested_title,
          description: analysis.metadata.suggested_description,
          tags: analysis.metadata.suggested_tags,
          categoryId: mapCategoryToId(analysis.metadata.category),
          privacyStatus: scheduledDate ? 'private' : 'public',
          publishAt: scheduledDate ? new Date(scheduledDate) : undefined
        }
      );

      // 6. 上传缩略图
      await uploadService.uploadThumbnail(
        youtubeVideoId,
        thumbnailBuffer
      );

      // 7. 更新任务记录
      await taskDoc.ref.update({
        youtubeVideoId,
        publishStatus: scheduledDate ? 'scheduled' : 'published',
        publishedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 8. 扣除 Credits
      await admin.firestore().doc(`users/${userId}`).update({
        credits: admin.firestore.FieldValue.increment(-10)
      });

      return {
        success: true,
        youtubeVideoId,
        youtubeUrl: `https://www.youtube.com/watch?v=${youtubeVideoId}`
      };
    } catch (error: any) {
      throw new functions.https.HttpsError('internal', error.message);
    }
  });

/**
 * 定时任务：发布定时视频
 */
export const checkScheduledPublishes = functions.pubsub
  .schedule('every 10 minutes')
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();

    const scheduledTasks = await admin.firestore()
      .collection('soraTasks')
      .where('publishStatus', '==', 'scheduled')
      .where('scheduledPublishDate', '<=', now)
      .limit(50)
      .get();

    for (const taskDoc of scheduledTasks.docs) {
      const taskData = taskDoc.data();

      try {
        const authData = await getYouTubeAuth(taskData.userId);
        const uploadService = new YouTubeUploadService(
          functions.config().youtube.client_id,
          functions.config().youtube.client_secret,
          functions.config().youtube.redirect_uri
        );
        uploadService.setCredentials(authData);

        // 更新为 public
        await uploadService.updateVideoStatus(
          taskData.youtubeVideoId,
          'public'
        );

        await taskDoc.ref.update({
          publishStatus: 'published',
          actualPublishedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (error) {
        console.error('Scheduled publish failed:', error);
      }
    }
  });

// 缩略图生成辅助函数
async function generateThumbnail(title: string): Promise<Buffer> {
  const genAI = new GoogleGenAI({
    apiKey: functions.config().gemini.api_key
  });

  const model = genAI.getGenerativeModel({
    model: 'imagen-3.0-generate-001'
  });

  const result = await model.generateImages({
    prompt: `YouTube thumbnail: ${title}.
      Eye-catching, high contrast, bold text overlay,
      professional design, 16:9 aspect ratio.`,
    numberOfImages: 1,
    aspectRatio: '16:9'
  });

  const imageUrl = result.images[0].imageUrl;
  const response = await fetch(imageUrl);
  return Buffer.from(await response.arrayBuffer());
}

function mapCategoryToId(category: string): string {
  const mapping: Record<string, string> = {
    'Education': '27',
    'Entertainment': '24',
    'Gaming': '20',
    'Howto & Style': '26',
    'Science & Technology': '28',
    'Travel & Events': '19',
    'People & Blogs': '22'
  };
  return mapping[category] || '22';
}
```

#### 前端发布界面

**新建 `/autotube/app/components/PublishManager.tsx`**
```typescript
export const PublishManager: React.FC<{
  taskId: string;
  suggestedMetadata: VideoMetadata;
  onPublish: (options: PublishOptions) => Promise<void>;
}> = ({ taskId, suggestedMetadata, onPublish }) => {
  const [title, setTitle] = useState(suggestedMetadata.title);
  const [description, setDescription] = useState(
    suggestedMetadata.description
  );
  const [tags, setTags] = useState(suggestedMetadata.tags);
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);

  return (
    <div className="bg-dark-surface border border-dark-border rounded-xl p-6">
      <h2 className="text-2xl font-bold text-white mb-6">
        Publish to YouTube
      </h2>

      {/* Title 输入框 */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={100}
        className="w-full bg-slate-800 border border-dark-border
          rounded-lg px-4 py-2 text-white mb-4"
      />

      {/* Description 文本域 */}
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={5000}
        className="w-full bg-slate-800 border border-dark-border
          rounded-lg px-4 py-2 text-white h-32 mb-4"
      />

      {/* Tags 显示 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {tags.map((tag, idx) => (
          <span key={idx} className="bg-brand-500/20 text-brand-300
            px-3 py-1 rounded-full text-sm">
            {tag}
          </span>
        ))}
      </div>

      {/* 定时发布 */}
      <input
        type="datetime-local"
        onChange={(e) => setScheduledDate(
          e.target.value ? new Date(e.target.value) : null
        )}
        className="bg-slate-800 border border-dark-border
          rounded-lg px-4 py-2 text-white mb-6"
      />

      {/* 发布按钮 */}
      <button
        onClick={() => onPublish({ taskId, title, description, tags, scheduledDate })}
        className="w-full bg-brand-600 hover:bg-brand-500
          text-white py-3 rounded-xl font-bold"
      >
        {scheduledDate ? 'Schedule Publish' : 'Publish Now'}
      </button>
    </div>
  );
};
```

#### Firebase Storage 规则

**`/autotube/storage.rules`**
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /generated-videos/{userId}/{videoId} {
      allow read: if request.auth != null &&
        request.auth.uid == userId;
      allow write: if false; // 只允许 Cloud Functions
    }

    match /thumbnails/{userId}/{imageId} {
      allow read: if request.auth != null &&
        request.auth.uid == userId;
      allow write: if false;
    }
  }
}
```

#### 测试验证
- [ ] 视频上传到 YouTube 成功
- [ ] 元数据正确设置
- [ ] 缩略图正确显示
- [ ] 定时发布功能正常

---

### 阶段 5: 完整工作流整合 + 优化 (3-4天)

#### 目标
整合所有步骤，实现端到端的批量自动化工作流。

#### 修改 AutoTubeApp.tsx - 完整工作流函数

```typescript
/**
 * 完整的自动化工作流
 * 分析 → 生成 → 发布
 */
const handleFullWorkflow = async (video: YouTubeVideo) => {
  const TOTAL_COST = 65; // 5 (分析) + 50 (Sora) + 10 (发布)

  const hasCredits = await deductCredits(TOTAL_COST);
  if (!hasCredits) return;

  setIsLoading(true);

  try {
    // Step 1: 分析视频
    showToast("Step 1/3: Analyzing video...", "success");
    const analyzeFunction = httpsCallable(
      functions,
      'analyzeVideoForSora'
    );
    const { data: { analysisId, analysis } } = await analyzeFunction({
      videoId: video.id,
      sourceTitle: video.title
    });

    // Step 2: 生成视频（异步）
    showToast("Step 2/3: Generating video with Sora...", "success");
    const generateFunction = httpsCallable(
      functions,
      'generateVideoWithSora'
    );
    const { data: { taskId } } = await generateFunction({
      analysisId,
      selectedPromptIndex: 0 // 使用第一个提示词
    });

    // Step 3: 轮询等待生成完成
    const videoUrl = await waitForVideoGeneration(taskId);

    // Step 4: 发布到 YouTube
    showToast("Step 3/3: Publishing to YouTube...", "success");
    const publishFunction = httpsCallable(
      functions,
      'publishToYouTube'
    );
    const { data: { youtubeVideoId, youtubeUrl } } =
      await publishFunction({
        taskId,
        scheduledDate: getNextPublishDate().toISOString()
      });

    showToast(
      `Success! Video published: ${youtubeUrl}`,
      "success"
    );

    // 刷新资产列表
    fetchAssets(user!.uid);
  } catch (error: any) {
    showToast(`Workflow failed: ${error.message}`, "error");
    // 退款（如果还未完成）
    if (user?.isDemo) {
      setUser(prev => prev ?
        { ...prev, credits: prev.credits + TOTAL_COST } : null
      );
    }
  } finally {
    setIsLoading(false);
  }
};

// 等待视频生成完成
const waitForVideoGeneration = (taskId: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const checkStatus = setInterval(async () => {
      const taskDoc = await getDoc(
        doc(dbRef.current, 'soraTasks', taskId)
      );
      const taskData = taskDoc.data();

      if (taskData?.status === 'completed') {
        clearInterval(checkStatus);
        resolve(taskData.videoUrl);
      } else if (taskData?.status === 'failed') {
        clearInterval(checkStatus);
        reject(new Error(taskData.errorMessage));
      }
    }, 10000); // 每 10 秒检查

    // 10 分钟超时
    setTimeout(() => {
      clearInterval(checkStatus);
      reject(new Error('Generation timeout'));
    }, 600000);
  });
};

// 获取下次发布时间（明天同一时间）
const getNextPublishDate = (): Date => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date;
};
```

#### 批量工作流（使用任务队列）

```typescript
/**
 * 批量生成完整工作流
 */
const handleBatchFullWorkflow = async () => {
  if (selectedVideoIds.size === 0) return;

  const COST_PER_VIDEO = 65;
  const TOTAL_COST = selectedVideoIds.size * COST_PER_VIDEO;

  const hasCredits = await deductCredits(TOTAL_COST);
  if (!hasCredits) return;

  setIsLoading(true);

  const selectedVideosList = videos.filter(v =>
    selectedVideoIds.has(v.id)
  );

  // 创建批量任务
  const batchId = `batch_${Date.now()}`;
  await setDoc(doc(dbRef.current, 'batchJobs', batchId), {
    userId: user!.uid,
    totalVideos: selectedVideosList.length,
    completedVideos: 0,
    status: 'running',
    createdAt: Timestamp.now()
  });

  // 为每个视频创建任务
  for (let i = 0; i < selectedVideosList.length; i++) {
    const video = selectedVideosList[i];
    const scheduleDate = new Date();
    scheduleDate.setDate(scheduleDate.getDate() + i + 1);

    // 异步调用（不等待）
    handleFullWorkflow(video).catch(error => {
      console.error(`Workflow failed for ${video.id}:`, error);
    });
  }

  showToast(
    `Batch workflow started for ${selectedVideosList.length} videos!`,
    "success"
  );
  setIsLoading(false);
  setView('schedule');
};
```

#### 错误重试机制

**Cloud Function:**
```typescript
/**
 * 定时任务：重试失败的任务
 */
export const retryFailedTasks = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    const failedTasks = await admin.firestore()
      .collection('soraTasks')
      .where('status', '==', 'failed')
      .where('retryCount', '<', 3)
      .limit(20)
      .get();

    for (const taskDoc of failedTasks.docs) {
      const taskData = taskDoc.data();

      try {
        // 重新创建 Cloud Task
        await createSoraTask(taskDoc.id, {
          prompt: taskData.prompt,
          duration: taskData.duration
        });

        await taskDoc.ref.update({
          status: 'pending',
          retryCount: admin.firestore.FieldValue.increment(1),
          lastRetryAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (error) {
        console.error(`Retry failed for ${taskDoc.id}:`, error);
      }
    }
  });
```

#### Firestore 索引优化

**`/autotube/firestore.indexes.json`**
```json
{
  "indexes": [
    {
      "collectionGroup": "soraTasks",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "soraTasks",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "soraTaskId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "soraTasks",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "publishStatus", "order": "ASCENDING" },
        { "fieldPath": "scheduledPublishDate", "order": "ASCENDING" }
      ]
    }
  ]
}
```

---

## 📊 成本估算（基于 Credit 系统）

### 每个操作的 Credit 成本

| 操作 | Credits | 说明 |
|------|---------|------|
| YouTube 视频字幕分析 | 5 | Gemini 文本分析 |
| Sora 2 视频生成（30秒） | 50 | 主要成本 |
| YouTube 自动发布 | 10 | 上传 + 缩略图 |
| **完整工作流** | **65** | 分析 + 生成 + 发布 |

### 批量处理

- 10 个视频自动化工作流：650 Credits
- 50 个视频自动化工作流：3,250 Credits

### 建议的 Credit 套餐（现有基础上调整）

| 套餐 | Credits | 价格 | 可生成视频数 |
|------|---------|------|-------------|
| Creator Pack | 500 | $5 | 7 个完整流程 |
| Pro Studio | 1,500 | $12 | 23 个完整流程 |
| Agency | 5,000 | $35 | 76 个完整流程 |

---

## 🗂️ 文件结构总览

```
autotube/
├── app/
│   ├── lib/
│   │   ├── youtube-api.ts           ✨ 新建 - YouTube 数据获取
│   │   ├── youtube-upload.ts        ✨ 新建 - YouTube 发布
│   │   ├── gemini-transcript-analyzer.ts  ✨ 新建 - 字幕分析
│   │   └── types.ts                 ✨ 新建 - 共享类型
│   ├── api/
│   │   └── youtube/
│   │       ├── auth/route.ts        ✨ 新建 - OAuth 回调
│   │       └── videos/route.ts      ✨ 新建 - 视频列表
│   └── components/
│       ├── AutoTubeApp.tsx          🔧 修改 - 集成新功能
│       ├── PublishManager.tsx       ✨ 新建 - 发布管理
│       └── VideoGenerationStatus.tsx ✨ 新建 - 状态显示
├── functions/                        ✨ 新建整个目录
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                 🎯 主要 Cloud Functions
│       └── services/
│           ├── sora.ts              - Sora API 封装
│           ├── youtube.ts           - YouTube 服务
│           └── gemini.ts            - Gemini 服务
├── .env.local                        🔧 添加新环境变量
├── firestore.indexes.json            ✨ 新建 - 数据库索引
├── firestore.rules                   🔧 更新规则
└── storage.rules                     ✨ 新建 - 存储规则
```

---

## 🔧 新增依赖列表

### 前端（autotube/package.json）
```json
{
  "dependencies": {
    "@google/genai": "^1.30.0",      // 已有
    "firebase": "^12.6.0",            // 已有
    "googleapis": "^140.0.0"          // ✨ 新增 - YouTube API
  }
}
```

### Cloud Functions（functions/package.json）
```json
{
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^5.0.0",
    "@google/genai": "^1.30.0",
    "googleapis": "^140.0.0",
    "@google-cloud/tasks": "^5.0.0",  // ✨ 任务队列
    "sharp": "^0.33.0"                // ✨ 图片处理
  }
}
```

---

## ⚠️ 潜在风险与缓解方案

### 风险 1: Sora API 超时或不稳定
**缓解**:
- 实现 3 次自动重试
- 仅在成功后扣除 Credits
- 提供任务取消功能

### 风险 2: YouTube API 配额耗尽
**缓解**:
- 监控配额使用
- 实现缓存减少调用
- 批量操作使用 batch API

### 风险 3: Cloud Functions 冷启动延迟
**缓解**:
- 使用 Min Instances (生产环境)
- 前端显示预期等待时间
- 关键函数使用 1GB+ 内存

### 风险 4: Gemini 字幕分析质量不足
**缓解**:
- 提供手动编辑提示词功能
- 支持用户选择多个 Sora 提示词
- 未来升级到视频分析（可选）

---

## 📅 实施时间线（17-22 工作日）

| 阶段 | 时间 | 关键里程碑 |
|------|------|-----------|
| **阶段 1: YouTube API** | 3-4天 | OAuth 认证成功，获取真实视频 |
| **阶段 2: Gemini 分析** | 4-5天 | 字幕分析，生成 Sora 提示词 |
| **阶段 3: Sora 生成** | 4-5天 | 任务队列，视频生成成功 |
| **阶段 4: YouTube 发布** | 4-5天 | 自动上传，定时发布 |
| **阶段 5: 整合优化** | 3-4天 | 端到端测试，批量工作流 |

---

## 🎯 关键实施要点

### 技术决策总结（基于用户选择）

1. **后端架构**: Firebase Cloud Functions
   - 无服务器，自动扩展
   - 与现有 Firebase 无缝集成
   - 支持长时间运行（9分钟）

2. **视频分析**: YouTube 字幕 + Gemini
   - **无需下载视频文件**
   - 成本低，速度快
   - 质量足够生成 Sora 提示词

3. **任务管理**: Google Cloud Tasks
   - 专业的队列系统
   - 支持重试、限流
   - 适合批量处理

4. **状态追踪**: 前端轮询 Firestore
   - 简单可靠
   - 无需 WebSocket
   - 10秒检查一次

### 优势分析

✅ **成本优化**: 字幕分析比视频分析便宜 10-20 倍
✅ **性能优化**: 无需大文件传输
✅ **架构简化**: 全部在 Firebase 生态内
✅ **可扩展性**: Cloud Tasks 自动管理并发
✅ **可靠性**: 自动重试 + 错误恢复

---

## 📝 关键文件清单

### 必须修改的文件
1. `/autotube/app/components/AutoTubeApp.tsx` - 核心前端逻辑
2. `/autotube/app/layout.tsx` - 可能需要添加 providers

### 必须新建的文件
1. `/autotube/app/lib/youtube-api.ts` - YouTube API 封装
2. `/autotube/app/lib/gemini-transcript-analyzer.ts` - 字幕分析
3. `/autotube/app/lib/youtube-upload.ts` - YouTube 上传
4. `/autotube/functions/src/index.ts` - Cloud Functions 入口
5. `/autotube/functions/src/services/sora.ts` - Sora API 封装
6. `/autotube/app/api/youtube/auth/route.ts` - OAuth 回调

### 配置文件
1. `.env.local` - 添加 YouTube 和 Sora API keys
2. `firestore.indexes.json` - 数据库索引
3. `storage.rules` - 存储权限规则

---

## 🚀 下一步行动

准备好开始实施时，建议按以下顺序进行：

1. **设置环境**
   - 创建 YouTube Cloud Console 项目
   - 获取 OAuth 凭证
   - 设置 Firebase Functions

2. **从阶段 1 开始**
   - 实现 YouTube OAuth
   - 测试视频列表获取
   - 验证字幕 API

3. **迭代开发**
   - 每个阶段完成后测试
   - 逐步集成到主工作流
   - 持续验证 Credits 系统

---

**总结**: 这是一个经过优化的实施方案，充分利用了现有架构，最小化了复杂度和成本，同时保持了专业性和可扩展性。使用字幕分析而非视频下载是关键优化，大幅降低了实施难度和运营成本。
