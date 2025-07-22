import * as SecureStore from "expo-secure-store";
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";
// Import the updated types from your `types/api.ts`
import type { User, Album, ApiResponse, Image, Comment } from "../types/api";
import Constants from "expo-constants";

const API_BASE_URL = Constants.expoConfig!.extra!.apiBaseUrl as string;
const API_KEY = Constants.expoConfig!.extra!.apiKey as string;

class ApiService {
  readonly apiKey: string = "generate-a-uuid-for-the-admin"; // Use a UUID generator for production
  private username: string | null = null;

  async setCredentials(username: string) {
    this.username = username;
    await SecureStore.setItemAsync("username", username);
  }

  async loadCredentials() {
    this.username = await SecureStore.getItemAsync("username");
  }

  async clearCredentials() {
    this.username = null;
    await SecureStore.deleteItemAsync("username");
  }

  private getHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${API_KEY}`,
      "X-Username": this.username || "",
      "Content-Type": "application/json",
    };
  }

  private buildUrl(endpoint: string): string {
    const baseUrl = API_BASE_URL.endsWith("/")
      ? API_BASE_URL.slice(0, -1)
      : API_BASE_URL;
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    return `${baseUrl}${cleanEndpoint}`;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = this.buildUrl(endpoint);
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      // Attempt to parse error as ApiResponse to get more specific message
      try {
        const errorJson: ApiResponse = JSON.parse(errorBody);
        throw new Error(
          `API Error: ${response.status} ${response.statusText} - ${errorJson.message || "Unknown API error"}`,
        );
      } catch {
        throw new Error(
          `API Error: ${response.status} ${response.statusText} - ${errorBody}`,
        );
      }
    }

    const jsonResponse: ApiResponse<T> = await response.json();
    if (jsonResponse.success === false) {
      throw new Error(
        `API Operation Failed: ${jsonResponse.message || "Unknown error"}`,
      );
    }
    // If T is explicitly ApiResponse, return the whole thing. Otherwise, return its data field.
    // This allows flexibility.
    return (
      jsonResponse.data !== undefined ? jsonResponse.data : jsonResponse
    ) as T;
  }

  // Authentication
  async validateCredentials() {
    // This endpoint should return { valid, role } directly, not nested in `data` as per common auth APIs.
    // We can special-case this or assume the API will return a direct object if T is not ApiResponse<T>
    // For now, let's assume `request` handles it.
    return this.request<{ valid: boolean; role: string }>("/api/auth/validate");
  }

  async getCurrentUser() {
    // Expecting data: User
    return this.request<User>("/api/auth/user");
  }

  // Albums
  async getAlbums() {
    // Expecting data: { albums: Album[] }
    return this.request<{ albums: Album[] }>("/api/albums/");
  }

  async createAlbum(name: string) {
    // This API might just return success/message directly or data: { albumId: number }
    // We'll treat `T` as `any` or a specific expected data type for simplicity.
    return this.request<any>("/api/albums/", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  // Images
  async getAlbumImages(albumId: number) {
    // Expecting data: { images: Image[] }
    return this.request<{ images: Image[] }>(`/api/images/album/${albumId}`);
  }

  async getPendingImages() {
    // Expecting data: { images: Image[] }
    return this.request<{ images: Image[] }>("/api/images/pending");
  }

  // Modified uploadImage to accept a progress callback and return the full Image object
  async uploadImage(
    albumId: number,
    imageUri: string,
    onProgress?: (progress: number) => void,
  ): Promise<{ image_id: number; filename: string }> {
    // Expecting the uploaded Image object in ApiResponse.data.image
    const fileUri = imageUri.startsWith("file://")
      ? imageUri
      : `file://${imageUri}`;

    const url = this.buildUrl("/api/images/upload");

    const uploadResumable = FileSystem.createUploadTask(
      url,
      fileUri,
      {
        httpMethod: "POST",
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: "image",
        parameters: { album_id: albumId.toString() },
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "X-Username": this.username || "",
        },
      },
      (progress) => {
        const percentage = Math.round(
          (progress.totalBytesSent / progress.totalBytesExpectedToSend) * 100,
        );
        onProgress?.(percentage);
      },
    );

    const result = await uploadResumable.uploadAsync();

    if (result.status >= 200 && result.status < 300) {
      const responseData: ApiResponse<{ image_id: number; filename: string }> =
        JSON.parse(result.body || "{}");
      if (responseData && responseData.success && responseData.data) {
        return responseData.data;
      }
      throw new Error(
        `Upload successful but unexpected response format: ${result.body}`,
      );
    } else {
      const errorBody = result.body || "Unknown error";
      throw new Error(`Upload failed: ${result.status} - ${errorBody}`);
    }
  }

  async approveImage(imageId: number) {
    return this.request<any>(`/api/images/${imageId}/approve`, {
      method: "POST",
    });
  }

  async rejectImage(imageId: number) {
    return this.request<any>(`/api/images/${imageId}/reject`, {
      method: "POST",
    });
  }

  // Comments
  async getImageComments(imageId: number) {
    // Expecting data: { comments: Comment[] }
    const response = await this.request<{ comments: Comment[] }>(
      `/api/comments/image/${imageId}`,
    );
    return response;
  }

  async addComment(imageId: number, content: string) {
    // Expecting data: { comment_id: number }
    return this.request<{ comment_id: number }>("/api/comments/", {
      method: "POST",
      body: JSON.stringify({ image_id: imageId, content }),
    });
  }

  getImageUrl(filename: string): string {
    const baseUrl = API_BASE_URL.endsWith("/")
      ? API_BASE_URL.slice(0, -1)
      : API_BASE_URL;
    return `${baseUrl}/api/images/${filename}`;
  }
}

export const apiService = new ApiService();
