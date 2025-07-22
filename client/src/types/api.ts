export interface User {
  id: number;
  username: string;
  display_name: string;
  role: "admin" | "consumer";
  created_at: string;
}

export interface Album {
  id: number;
  name: string;
  created_at?: string;
  image_count?: number;
  total_size?: number;
}

export interface Image {
  id: number;
  filename: string;
  album_id?: number;
  status?: "pending" | "approved" | "rejected";
  uploaded_by?: string;
  created_at?: string;
  file_size?: number;
  width?: number;
  height?: number;
}

export interface Comment {
  id: number;
  content: string;
  author: string;
  created_at: string;
  image_id: number;
}

export interface ApiResponse<T = any> {
  success?: boolean;
  message?: string;
  data?: T;
}

export interface LocalImage {
  id: -1; // Special ID to indicate it's not a server image
  localId: string; // A unique UUID generated client-side for this specific upload operation
  localUri: string; // The full path to the image on the device
  filename: string; // Derived from localUri, or temp name
  status: "local-pending-upload" | "local-uploading" | "local-upload-failed"; // UI-specific status
  uploadProgress: number; // 0-100, specific to this local upload
  created_at: string; // Timestamp when it was selected locally
  file_size?: number; // Optional metadata from asset
  width?: number;
  height?: number;
}

// Union type for items displayed in the FlatList (can be a server Image or a local pending upload)
export type GalleryImage = Image | LocalImage;

// More granular sync state for individual images (used in SyncService and GalleryScreen)
export interface ImageSyncState {
  isDownloaded: boolean;
  isUploading: boolean; // Is *this specific server image* currently being uploaded/processed?
  isDownloading: boolean; // Is *this specific server image* currently being downloaded?
  isPendingUpload: boolean; // Is this server image waiting for re-upload?
  isPendingDownload: boolean; // Is this server image waiting for download?
  localUri?: string; // Local URI if downloaded or in viewer cache (matches OfflineImage.localPath conceptually)
  downloadProgress?: number; // 0-100
  uploadProgress?: number; // 0-100 (for *existing* images being re-uploaded)
  size?: number; // Size of the image file in bytes
}

export interface SyncState {
  isDownloaded: boolean;
  isUploading: boolean;
  isDownloading: boolean;
  isPending: boolean;
  downloadProgress?: number;
  uploadProgress?: number;
  localPath?: string;
  fileSize?: number;
}

export interface OfflineImage {
  id: number;
  filename: string;
  localPath: string; // Keep this name for now as it's in your provided type
  albumId: number;
  albumName: string;
  fileSize: number;
  downloadedAt: number;
  metadata?: {
    width?: number;
    height?: number;
    created_at?: string;
  };
}
