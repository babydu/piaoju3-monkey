import { Router, type Request, type Response } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client.js';

const router = Router();

// 反馈类型
type FeedbackType = 'bug' | 'suggestion' | 'other';

// 创建反馈
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ success: false, error: '未授权' });
    }

    const { type, content, contact } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: '反馈内容不能为空' });
    }

    const validTypes: FeedbackType[] = ['bug', 'suggestion', 'other'];
    const feedbackType = validTypes.includes(type) ? type : 'suggestion';

    const client = getSupabaseClient();

    // 插入反馈
    const { data, error } = await client
      .from('feedbacks')
      .insert({
        user_id: userId,
        type: feedbackType,
        content: content.trim(),
        contact: contact?.trim() || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('创建反馈失败:', error);
      return res.status(500).json({ success: false, error: '提交失败，请稍后重试' });
    }

    // TODO: 发送邮件通知管理员
    // 这里可以集成邮件服务，发送通知邮件给管理员
    console.log(`[Feedback] 新反馈 #${data.id}: [${feedbackType}] ${content.substring(0, 50)}...`);

    res.json({ success: true, feedback: data });
  } catch (error) {
    console.error('提交反馈错误:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// 获取用户反馈列表
router.get('/my', async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    if (!userId) {
      return res.status(401).json({ success: false, error: '未授权' });
    }

    const client = getSupabaseClient();

    const { data, error } = await client
      .from('feedbacks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('获取反馈列表失败:', error);
      return res.status(500).json({ success: false, error: '获取失败' });
    }

    res.json({ success: true, feedbacks: data });
  } catch (error) {
    console.error('获取反馈列表错误:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// 获取反馈详情
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.headers.authorization?.replace("Bearer ", "");
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, error: '未授权' });
    }

    const client = getSupabaseClient();

    const { data, error } = await client
      .from('feedbacks')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('获取反馈详情失败:', error);
      return res.status(404).json({ success: false, error: '反馈不存在' });
    }

    res.json({ success: true, feedback: data });
  } catch (error) {
    console.error('获取反馈详情错误:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

export default router;
