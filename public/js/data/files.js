/**
 * 文件数据（二进制在服务器磁盘，元数据在 SQLite）
 */
import { Api } from '../core/api.js';

export const Files = {
  async list() {
    const res = await Api.get('/files');
    return { files: (res && res.files) || [], officeReady: !!(res && res.officeReady) };
  },

  /** 公开库：所有用户标记为公开的文件（含自己的，带 isMine 标记） */
  async listPublic() {
    const res = await Api.get('/files/public');
    return { files: (res && res.files) || [], officeReady: !!(res && res.officeReady) };
  },

  upload(file, visibility, name) {
    const form = new FormData();
    form.append('file', file);
    form.append('visibility', visibility === 'private' ? 'private' : 'public');
    if (name) form.append('name', name);
    return Api.call('/files', { method: 'POST', body: form });
  },

  setVisibility(id, visibility) {
    return Api.put('/files/' + encodeURIComponent(id) + '/visibility', { visibility });
  },

  rename(id, name) {
    return Api.put('/files/' + encodeURIComponent(id) + '/rename', { name });
  },

  remove(id) {
    return Api.del('/files/' + encodeURIComponent(id));
  },

  /** 下载走 GET，浏览器自动带 Cookie 完成鉴权 */
  downloadUrl(id) {
    return '/api/files/' + encodeURIComponent(id) + '/download';
  },

  /** 预览返回的是内容本身（图片/PDF/文本），不是 JSON */
  previewUrl(id) {
    return '/api/files/' + encodeURIComponent(id) + '/preview';
  },

  /** 触发浏览器下载，文件名由服务端 Content-Disposition 决定 */
  download(id) {
    const a = document.createElement('a');
    a.href = this.downloadUrl(id);
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
};
