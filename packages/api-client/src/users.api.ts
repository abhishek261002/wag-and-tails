import type { ApiClient } from './client.js';

export interface ProfileUpdate {
  firstName?: string;
  lastName?: string;
  /** '' clears it. */
  email?: string;
  /** YYYY-MM-DD, or null to clear. */
  dateOfBirth?: string | null;
  /** A path returned by uploadAvatar, or null to remove the photo. */
  avatarUrl?: string | null;
}

export class UsersApi {
  constructor(private client: ApiClient) {}

  me(): Promise<any> {
    return this.client.get('/users/me');
  }

  updateProfile(data: ProfileUpdate): Promise<any> {
    return this.client.patch('/users/me', data);
  }

  /**
   * Uploads a profile photo and returns its stored path (save it with updateProfile). The file is sent as a Blob
   * so it works identically on native and web.
   */
  async uploadAvatar(file: { uri: string; name: string }): Promise<string> {
    const blob = await (await fetch(file.uri)).blob();
    const formData = new FormData();
    formData.append('file', blob, file.name);
    formData.append('entity', 'user');
    formData.append('entityId', 'me');
    const uploaded = await this.client.post<{ url: string }>('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return uploaded.url;
  }
}
