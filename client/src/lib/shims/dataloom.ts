import type { AxiosInstance } from 'axios';
import axios from 'axios';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ?? '';

/**
 * 上传单个文件到后端，返回可直接放进 img src 的绝对地址。
 */
const http: AxiosInstance = axios.create({ baseURL: API_BASE });

async function uploadFile(file: File): Promise<{ data: { download_url: string } | null; error: unknown }> {
  const form = new FormData();
  form.append('file', file);
  try {
    const res = await http.post('/api/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const payload = res.data as { success?: boolean; data?: { url?: string } };
    if (!payload?.success || !payload?.data?.url) {
      return { data: null, error: { message: '上传失败' } };
    }
    return { data: { download_url: payload.data.url }, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

/**
 * 兼容原先平台 SDK 的调用形态：
 *   const dataloom = await getDataloom();
 *   const { data, error } = await dataloom.storage.from(bucketId).uploadFile(file);
 */
export async function getDataloom() {
  return {
    storage: {
      from: (_bucketId?: string) => ({
        uploadFile: (file: File) => uploadFile(file),
      }),
    },
  };
}
