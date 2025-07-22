import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import * as Notifications from "expo-notifications";
import { Alert, Platform } from "react-native";
import { apiService } from "./api";
import { UrlHelper } from "../utils/urlHelpers";
import { Image as ImageType, ImageSyncState, OfflineImage } from "../types/api";

import { v4 as uuidv4 } from "uuid";
import { imageCacheService } from "./imageCacheService";

// --- INTERFACES FOR INTERNAL SYNC SERVICE STATE ---

interface PendingUpload {
  id: string;
  localUri: string;
  albumId: number;
  filename: string;
  timestamp: number;
  status: "pending" | "uploading" | "failed";
  progress: number;
  tempLocalImageId: string;
  file_size?: number;
  width?: number;
  height?: number;
  created_at?: string;
}

interface PendingDownload {
  id: string;
  imageId: number;
  filename: string;
  albumName: string;
  albumId: number;
  timestamp: number;
  status: "pending" | "downloading" | "failed";
  progress: number;
}

export interface SyncStatus {
  isOnline: boolean;
  lastSync: number;
  pendingUploads: number;
  pendingDownloads: number;
  totalOfflineSize: number;
  offlineImagesCount: number;
  overallDownloadProgress: number;
  overallUploadProgress: number;
  syncInProgress: boolean;
}

// NEW: Define the listener signature. It passes the temp ID and the new server data.
type UploadCompleteListener = (
  tempLocalImageId: string,
  newImage: Partial<ImageType> & { id: number; album_id: number },
) => void;

// --- SYNC SERVICE CLASS ---

class SyncService {
  private readonly PENDING_UPLOADS_KEY = "pendingUploads";
  private readonly PENDING_DOWNLOADS_KEY = "pendingDownloads";
  private readonly OFFLINE_IMAGES_KEY = "offlineImages";
  private readonly LAST_SYNC_KEY = "lastSync";

  private pendingUploadsCache: PendingUpload[] = [];
  private pendingDownloadsCache: PendingDownload[] = [];
  private offlineImagesCache: Record<number, OfflineImage> = {};
  private imageSyncStatesCache = new Map<number, ImageSyncState>();
  private globalSyncStatusCache: SyncStatus | null = null;

  private syncStatusListeners: ((status: SyncStatus) => void)[] = [];
  private imageSyncStateListeners = new Map<
    number,
    ((imageId: number, state: ImageSyncState) => void)[]
  >();
  // NEW: Add the listener array
  private onUploadCompleteListeners: UploadCompleteListener[] = [];

  private isSyncing: boolean = false;
  private readonly SYNC_NOTIFICATION_IDENTIFIER = "sync-progress-notification";

  constructor() {
    this.init();
  }

  private async init() {
    await this.requestNotificationPermissions();
    this.registerNotificationChannels();
    await this.loadPersistentState();
    await this.updateGlobalSyncStatus();
  }

  private async requestNotificationPermissions() {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      console.warn("Notification permissions not granted.");
    }
  }

  public async registerNotificationChannels() {
    if (Platform.OS === "android") {
      const channels = await Notifications.getNotificationChannelsAsync();
      if (!channels.find((c) => c.id === "sync-progress-channel")) {
        await Notifications.setNotificationChannelAsync(
          "sync-progress-channel",
          {
            name: "Sync Progress",
            importance: Notifications.AndroidImportance.LOW,
            vibrationPattern: [0],
            showBadge: false,
            sound: null,
          },
        );
      }
      if (!channels.find((c) => c.id === "general-notifications")) {
        await Notifications.setNotificationChannelAsync(
          "general-notifications",
          {
            name: "General Notifications",
            importance: Notifications.AndroidImportance.DEFAULT,
            vibrationPattern: [250, 250, 250],
            showBadge: true,
            sound: "default",
          },
        );
      }
    }
  }

  private async loadPersistentState() {
    const [uploadsData, downloadsData, offlineImagesData] = await Promise.all([
      AsyncStorage.getItem(this.PENDING_UPLOADS_KEY),
      AsyncStorage.getItem(this.PENDING_DOWNLOADS_KEY),
      AsyncStorage.getItem(this.OFFLINE_IMAGES_KEY),
    ]);

    this.pendingUploadsCache = uploadsData ? JSON.parse(uploadsData) : [];
    this.pendingDownloadsCache = downloadsData ? JSON.parse(downloadsData) : [];
    this.offlineImagesCache = offlineImagesData
      ? JSON.parse(offlineImagesData)
      : {};

    Object.values(this.offlineImagesCache).forEach((img) => {
      this.updateImageSyncStateInternal(img.id, {
        isDownloaded: true,
        localUri: img.localPath,
      });
    });

    this.pendingDownloadsCache.forEach((download) => {
      this.updateImageSyncStateInternal(download.imageId, {
        isDownloading: download.status === "downloading",
        isPendingDownload: download.status === "pending",
        downloadProgress: download.progress,
      });
    });
  }

  // --- PUBLIC GETTERS ---

  async getSyncStatus(): Promise<SyncStatus> {
    const totalOfflineSize = Object.values(this.offlineImagesCache).reduce(
      (sum, img) => sum + img.fileSize,
      0,
    );

    const activeDownloads = this.pendingDownloadsCache.filter(
      (d) => d.status === "downloading",
    );
    const totalDownloadProgress =
      activeDownloads.length > 0
        ? activeDownloads.reduce((sum, d) => sum + d.progress, 0) /
          activeDownloads.length
        : 0;

    const activeUploads = this.pendingUploadsCache.filter(
      (u) => u.status === "uploading",
    );
    const totalUploadProgress =
      activeUploads.length > 0
        ? activeUploads.reduce((sum, u) => sum + u.progress, 0) /
          activeUploads.length
        : 0;

    const lastSync = (await AsyncStorage.getItem(this.LAST_SYNC_KEY))
      ? Number.parseInt((await AsyncStorage.getItem(this.LAST_SYNC_KEY))!)
      : 0;

    this.globalSyncStatusCache = {
      isOnline: true,
      lastSync: lastSync,
      pendingUploads: this.pendingUploadsCache.filter(
        (u) => u.status === "pending" || u.status === "uploading",
      ).length,
      pendingDownloads: this.pendingDownloadsCache.filter(
        (d) => d.status === "pending" || d.status === "downloading",
      ).length,
      totalOfflineSize,
      offlineImagesCount: Object.keys(this.offlineImagesCache).length,
      overallDownloadProgress: totalDownloadProgress,
      overallUploadProgress: totalUploadProgress,
      syncInProgress: this.isSyncing,
    };
    return this.globalSyncStatusCache;
  }

  async getImageSyncState(imageId: number): Promise<ImageSyncState> {
    if (this.imageSyncStatesCache.has(imageId)) {
      return this.imageSyncStatesCache.get(imageId)!;
    }

    const downloadItem = this.pendingDownloadsCache.find(
      (d) => d.imageId === imageId,
    );
    const uploadItem = this.pendingUploadsCache.find(
      (u) => false, // some mapping logic if ImageType is re-uploaded
    );
    const offlineImage = this.offlineImagesCache[imageId];

    const state: ImageSyncState = {
      isDownloaded: !!offlineImage,
      isUploading: uploadItem?.status === "uploading",
      isDownloading: downloadItem?.status === "downloading",
      isPendingUpload: this.pendingUploadsCache.some(
        (u) => u.status === "pending", // && mapping to imageId
      ),
      isPendingDownload: downloadItem?.status === "pending",
      localUri: offlineImage?.localPath,
      downloadProgress: downloadItem?.progress || 0,
      uploadProgress: uploadItem?.progress || 0,
    };

    this.imageSyncStatesCache.set(imageId, state);
    return state;
  }

  // --- QUEUING OPERATIONS ---

  async queueUpload(
    albumId: number,
    localUri: string,
    tempLocalImageId: string,
    file_size?: number,
    width?: number,
    height?: number,
    created_at?: string,
  ): Promise<string> {
    const uploadId = uuidv4();

    const pendingUpload: PendingUpload = {
      id: uploadId,
      albumId,
      localUri,
      filename: localUri.split("/").pop() || `${uploadId}.jpg`,
      timestamp: Date.now(),
      status: "pending",
      progress: 0,
      tempLocalImageId,
      file_size,
      width,
      height,
      created_at,
    };

    this.pendingUploadsCache.push(pendingUpload);
    await this.persistPendingUploads();
    await this.updateGlobalSyncStatus();
    return uploadId;
  }

  async queueDownload(
    imageId: number,
    filename: string,
    albumName: string,
    albumId: number,
  ): Promise<string> {
    const downloadId = uuidv4();

    const existingDownload = this.pendingDownloadsCache.find(
      (d) => d.imageId === imageId && d.status !== "failed",
    );
    if (existingDownload) {
      console.log(`Image ${imageId} already queued for download.`);
      return existingDownload.id;
    }

    if (this.offlineImagesCache[imageId]) {
      console.log(`Image ${imageId} already downloaded.`);
      return "";
    }

    const pendingDownload: PendingDownload = {
      id: downloadId,
      imageId,
      filename,
      albumName,
      albumId,
      timestamp: Date.now(),
      status: "pending",
      progress: 0,
    };

    this.pendingDownloadsCache.push(pendingDownload);
    await this.persistPendingDownloads();

    this.updateImageSyncStateInternal(imageId, {
      isPendingDownload: true,
      downloadProgress: 0,
    });
    await this.updateGlobalSyncStatus();

    return downloadId;
  }

  async queueAlbumDownload(
    albumId: number,
    albumName: string,
    images: ImageType[],
  ): Promise<void> {
    for (const image of images) {
      const alreadyQueued = this.pendingDownloadsCache.some(
        (d) => d.imageId === image.id,
      );
      const alreadyDownloaded = this.offlineImagesCache[image.id];

      if (!alreadyQueued && !alreadyDownloaded) {
        await this.queueDownload(image.id, image.filename, albumName, albumId);
      }
    }
  }

  // --- PROCESSING OPERATIONS ---

  async syncAll(): Promise<{
    uploads: { success: number; failed: number };
    downloads: { success: number; failed: number };
  }> {
    if (this.isSyncing) {
      console.log("Sync already in progress, skipping.");
      return {
        uploads: { success: 0, failed: 0 },
        downloads: { success: 0, failed: 0 },
      };
    }

    this.isSyncing = true;
    await this.updateGlobalSyncStatus(true);
    await this.sendProgressNotification("Sync in progress", "Starting...", 0, 100);

    const uploadResults = await this.processPendingUploads();
    const downloadResults = await this.processPendingDownloads();

    this.isSyncing = false;
    await this.updateGlobalSyncStatus();
    await this.clearNotification(this.SYNC_NOTIFICATION_IDENTIFIER);

    if (uploadResults.success + downloadResults.success > 0) {
      this.sendInstantNotification(
        "Sync Complete",
        `Downloaded: ${downloadResults.success}, Uploaded: ${uploadResults.success}`,
        Notifications.AndroidImportance.DEFAULT,
      );
    } else {
      this.sendInstantNotification(
        "Sync Complete",
        "No new items to sync.",
        Notifications.AndroidImportance.DEFAULT,
      );
    }

    if (uploadResults.failed > 0 || downloadResults.failed > 0) {
      this.sendInstantNotification(
        "Sync Errors",
        `Some items failed to sync. Uploads: ${uploadResults.failed}, Downloads: ${downloadResults.failed}.`,
        Notifications.AndroidImportance.HIGH,
        true,
      );
    }

    return { uploads: uploadResults, downloads: downloadResults };
  }

  // MODIFIED: This is the fully corrected upload processing logic.
  private async processPendingUploads(): Promise<{
    success: number;
    failed: number;
  }> {
    let success = 0;
    let failed = 0;
    const uploadsToProcess = this.pendingUploadsCache.filter(
      (u) => u.status === "pending" || u.status === "failed",
    );

    for (const upload of uploadsToProcess) {
      try {
        await this.updatePendingUploadState(upload.id, "uploading", 0);

        const uploadResult = await apiService.uploadImage(
          upload.albumId,
          upload.localUri,
          (progress) => {
            this.updatePendingUploadState(upload.id, "uploading", progress);
          },
        );

        if (uploadResult && uploadResult.image_id) {
          console.log(
            `Upload complete for temp ID ${upload.tempLocalImageId}. New Server ID: ${uploadResult.image_id}`,
          );
          success++;

          const newImage: Partial<ImageType> & {
            id: number;
            album_id: number;
          } = {
            id: uploadResult.image_id,
            filename: uploadResult.filename,
            album_id: upload.albumId,
            created_at: upload.created_at || new Date().toISOString(),
            width: upload.width,
            height: upload.height,
          };

          this.notifyUploadCompleteListener(upload.tempLocalImageId, newImage);
          await this.removePendingUpload(upload.id);

          try {
            await FileSystem.deleteAsync(upload.localUri, { idempotent: true });
          } catch (fileDeleteError) {
            console.warn(
              `Failed to delete local upload file ${upload.localUri}:`,
              fileDeleteError,
            );
          }
        } else {
          throw new Error("API did not return a valid image object.");
        }
      } catch (error) {
        console.error(
          `Failed to upload ${upload.filename} (ID: ${upload.id}):`,
          error,
        );
        await this.updatePendingUploadState(upload.id, "failed");
        failed++;
      }
    }
    return { success, failed };
  }

  private async processPendingDownloads(): Promise<{
    success: number;
    failed: number;
  }> {
    let success = 0;
    let failed = 0;
    const downloadsToProcess = this.pendingDownloadsCache.filter(
      (d) => d.status === "pending" || d.status === "failed",
    );

    for (const download of downloadsToProcess) {
      try {
        await this.updatePendingDownloadState(download.id, "downloading", 0);
        this.updateImageSyncStateInternal(download.imageId, {
          isDownloading: true,
          isPendingDownload: false,
          downloadProgress: 0,
        });

        const imageUrl = apiService.getImageUrl(download.filename);
        if (!UrlHelper.isValidUrl(imageUrl)) {
          throw new Error(`Invalid image URL: ${imageUrl}`);
        }

        const localPath = UrlHelper.joinPaths(
          FileSystem.documentDirectory || "",
          "offline_images",
          download.filename,
        );
        const dirUri = UrlHelper.joinPaths(
          FileSystem.documentDirectory || "",
          "offline_images",
        );
        await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });

        const downloadResumable = FileSystem.createDownloadResumable(
          imageUrl,
          localPath,
          {},
          (downloadProgress) => {
            const progress =
              (downloadProgress.totalBytesWritten /
                downloadProgress.totalBytesExpectedToWrite) *
              100;
            this.updatePendingDownloadState(
              download.id,
              "downloading",
              progress,
            );
            this.updateImageSyncStateInternal(download.imageId, {
              downloadProgress: progress,
            });
            this.updateGlobalNotificationProgress();
          },
        );

        const result = await downloadResumable.downloadAsync();

        if (result && result.status === 200) {
          const fileInfo = await FileSystem.getInfoAsync(localPath);
          const fileSize = fileInfo.exists ? fileInfo.size || 0 : 0;

          let metadata: OfflineImage["metadata"] = {};
          if (!fileInfo.exists) {
            alert("File not found after download, this should not happen.");
            continue;
          }
          if (fileInfo.modificationTime) {
            metadata.created_at = new Date(
              fileInfo.modificationTime * 1000,
            ).toISOString();
          }

          await this.storeOfflineImage({
            id: download.imageId,
            filename: download.filename,
            localPath: result.uri,
            albumId: download.albumId,
            albumName: download.albumName,
            fileSize: fileSize,
            downloadedAt: Date.now(),
            metadata: metadata,
          });

          await this.saveToMediaLibrary(result.uri, download.albumName);

          success++;
          await this.removePendingDownload(download.id);
          this.updateImageSyncStateInternal(download.imageId, {
            isDownloaded: true,
            isDownloading: false,
            isPendingDownload: false,
            localUri: result.uri,
            downloadProgress: 100,
          });
        } else {
          throw new Error(
            `Download failed with status ${result?.status || "unknown"}`,
          );
        }
      } catch (error) {
        console.error(`Failed to download ${download.filename}:`, error);
        failed++;
        await this.updatePendingDownloadState(download.id, "failed");
        this.updateImageSyncStateInternal(download.imageId, {
          isDownloading: false,
          isPendingDownload: false,
          downloadProgress: 0,
        });
      }
    }
    return { success, failed };
  }

  // --- INTERNAL STATE MANAGEMENT & PERSISTENCE ---

  private async persistPendingUploads() {
    await AsyncStorage.setItem(
      this.PENDING_UPLOADS_KEY,
      JSON.stringify(this.pendingUploadsCache),
    );
  }

  private async persistPendingDownloads() {
    await AsyncStorage.setItem(
      this.PENDING_DOWNLOADS_KEY,
      JSON.stringify(this.pendingDownloadsCache),
    );
  }

  private async updatePendingUploadState(
    uploadId: string,
    status: PendingUpload["status"],
    progress: number = 0,
  ): Promise<void> {
    const index = this.pendingUploadsCache.findIndex(
      (upload) => upload.id === uploadId,
    );
    if (index !== -1) {
      this.pendingUploadsCache[index].status = status;
      this.pendingUploadsCache[index].progress = progress;
      await this.persistPendingUploads();
      await this.updateGlobalSyncStatus();
    }
  }

  private async removePendingUpload(uploadId: string): Promise<void> {
    this.pendingUploadsCache = this.pendingUploadsCache.filter(
      (upload) => upload.id !== uploadId,
    );
    await this.persistPendingUploads();
    await this.updateGlobalSyncStatus();
  }

  private async updatePendingDownloadState(
    downloadId: string,
    status: PendingDownload["status"],
    progress: number = 0,
  ): Promise<void> {
    const index = this.pendingDownloadsCache.findIndex(
      (download) => download.id === downloadId,
    );
    if (index !== -1) {
      this.pendingDownloadsCache[index].status = status;
      this.pendingDownloadsCache[index].progress = progress;
      await this.persistPendingDownloads();
      await this.updateGlobalSyncStatus();
    }
  }

  private async removePendingDownload(downloadId: string): Promise<void> {
    this.pendingDownloadsCache = this.pendingDownloadsCache.filter(
      (download) => download.id !== downloadId,
    );
    await this.persistPendingDownloads();
    await this.updateGlobalSyncStatus();
  }

  private async storeOfflineImage(image: OfflineImage): Promise<void> {
    this.offlineImagesCache[image.id] = image;
    await AsyncStorage.setItem(
      this.OFFLINE_IMAGES_KEY,
      JSON.stringify(this.offlineImagesCache),
    );
    this.updateImageSyncStateInternal(image.id, {
      isDownloaded: true,
      localUri: image.localPath,
    });
    await this.updateGlobalSyncStatus();
  }

  async removeOfflineImage(imageId: number): Promise<void> {
    const image = this.offlineImagesCache[imageId];
    if (image) {
      try {
        await FileSystem.deleteAsync(image.localPath, { idempotent: true });
      } catch (error) {
        console.warn(`Failed to delete local file ${image.localPath}:`, error);
      }
      delete this.offlineImagesCache[imageId];
      await AsyncStorage.setItem(
        this.OFFLINE_IMAGES_KEY,
        JSON.stringify(this.offlineImagesCache),
      );
      this.updateImageSyncStateInternal(imageId, {
        isDownloaded: false,
        localUri: undefined,
      });
      await this.updateGlobalSyncStatus();
    }
  }

  async getOfflineImagesForAlbum(albumId: number): Promise<OfflineImage[]> {
    return Object.values(this.offlineImagesCache).filter(
      (img) => img.albumId === albumId,
    );
  }

  private async updateLastSync(): Promise<void> {
    await AsyncStorage.setItem(this.LAST_SYNC_KEY, Date.now().toString());
    await this.updateGlobalSyncStatus();
  }

  // --- HELPER METHODS ---

  formatStorageSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${
      sizes[i]
    }`;
  }

  private async saveToMediaLibrary(
    uri: string,
    albumName: string,
  ): Promise<void> {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        console.warn("Media Library permission not granted.");
        return;
      }

      const asset = await MediaLibrary.createAssetAsync(uri);
      const albums = await MediaLibrary.getAlbumsAsync();
      const existingAlbum = albums.find((album) => album.title === albumName);

      if (existingAlbum) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], existingAlbum, false);
      } else {
        await MediaLibrary.createAlbumAsync(albumName, asset, false);
      }
    } catch (error) {
      console.log("Failed to save to Media Library:", error);
    }
  }

  // --- GLOBAL STATE UPDATE & LISTENERS ---

  // NEW: Method to add a listener for upload completions
  addOnUploadCompleteListener(listener: UploadCompleteListener): () => void {
    this.onUploadCompleteListeners.push(listener);
    return () => {
      this.onUploadCompleteListeners = this.onUploadCompleteListeners.filter(
        (l) => l !== listener,
      );
    };
  }

  // NEW: Method to notify all registered upload complete listeners
  private notifyUploadCompleteListener(
    tempLocalImageId: string,
    newImage: Partial<ImageType> & { id: number; album_id: number },
  ) {
    this.onUploadCompleteListeners.forEach((listener) =>
      listener(tempLocalImageId, newImage),
    );
  }

  // NEW: Public getter to safely expose pending uploads without breaking encapsulation
  public getPendingUploads(): Readonly<PendingUpload[]> {
    return this.pendingUploadsCache;
  }

  private updateImageSyncStateInternal(
    imageId: number,
    updates: Partial<ImageSyncState>,
  ): void {
    const currentState = this.imageSyncStatesCache.get(imageId) || {
      isDownloaded: false,
      isUploading: false,
      isDownloading: false,
      isPendingUpload: false,
      isPendingDownload: false,
      localUri: undefined,
      downloadProgress: 0,
      uploadProgress: 0,
    };
    const newState = { ...currentState, ...updates };
    this.imageSyncStatesCache.set(imageId, newState);
    this.notifyImageSyncStateListeners(imageId, newState);
  }

  private async updateGlobalSyncStatus(
    inProgressOverride?: boolean,
  ): Promise<void> {
    const status = await this.getSyncStatus();
    if (inProgressOverride !== undefined) {
      status.syncInProgress = inProgressOverride;
    }
    this.globalSyncStatusCache = status;
    this.notifySyncStatusListeners(status);
    this.updateGlobalNotificationProgress();
  }

  addSyncStatusListener(listener: (status: SyncStatus) => void): () => void {
    this.syncStatusListeners.push(listener);
    if (this.globalSyncStatusCache) {
      listener(this.globalSyncStatusCache);
    } else {
      this.getSyncStatus().then(listener);
    }
    return () => {
      this.syncStatusListeners = this.syncStatusListeners.filter(
        (l) => l !== listener,
      );
    };
  }

  private notifySyncStatusListeners(status: SyncStatus) {
    this.syncStatusListeners.forEach((listener) => listener(status));
  }

  addImageSyncStateListener(
    imageId: number,
    listener: (imageId: number, state: ImageSyncState) => void,
  ): () => void {
    if (!this.imageSyncStateListeners.has(imageId)) {
      this.imageSyncStateListeners.set(imageId, []);
    }
    this.imageSyncStateListeners.get(imageId)?.push(listener);
    if (this.imageSyncStatesCache.has(imageId)) {
      listener(imageId, this.imageSyncStatesCache.get(imageId)!);
    } else {
      this.getImageSyncState(imageId).then((state) =>
        listener(imageId, state),
      );
    }

    return () => {
      const listeners = this.imageSyncStateListeners.get(imageId);
      if (listeners) {
        this.imageSyncStateListeners.set(
          imageId,
          listeners.filter((l) => l !== listener),
        );
      }
    };
  }

  private notifyImageSyncStateListeners(
    imageId: number,
    state: ImageSyncState,
  ) {
    this.imageSyncStateListeners.get(imageId)?.forEach((listener) => {
      listener(imageId, state);
    });
  }

  // --- NOTIFICATION MANAGEMENT ---

  private async sendProgressNotification(
    title: string,
    message: string,
    current: number,
    total: number,
  ) {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      console.warn(
        "Notifications permission not granted, cannot send progress notification.",
      );
      return;
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body: message,
          data: { type: "sync_progress" },
          android: {
            channelId: "sync-progress-channel",
            ongoing: true,
            progress: {
              current,
              total,
              indeterminate: false,
            },
            autoDismiss: false,
          },
          ios: {
            badge: false,
            sound: false,
            _displayInForeground: true,
          },
        },
        trigger: null,
        identifier: this.SYNC_NOTIFICATION_IDENTIFIER,
      });
    } catch (error) {
      console.error("Failed to schedule progress notification:", error);
    }
  }

  private async updateGlobalNotificationProgress() {
    const status = this.globalSyncStatusCache || (await this.getSyncStatus());
    const totalItems = status.pendingDownloads + status.pendingUploads;

    if (totalItems === 0 || !status.syncInProgress) {
      await this.clearNotification(this.SYNC_NOTIFICATION_IDENTIFIER);
      return;
    }

    let currentProgressSum = 0;
    this.pendingDownloadsCache.forEach(
      (d) => (currentProgressSum += d.progress),
    );
    this.pendingUploadsCache.forEach((u) => (currentProgressSum += u.progress));

    const overallProgress =
      totalItems > 0 ? Math.round(currentProgressSum / totalItems) : 0;

    let title = "Syncing Album";
    let body = "";
    if (status.pendingDownloads > 0 && status.pendingUploads > 0) {
      body = `Downloading ${status.pendingDownloads} • Uploading ${status.pendingUploads}`;
    } else if (status.pendingDownloads > 0) {
      body = `Downloading ${status.pendingDownloads} items`;
    } else if (status.pendingUploads > 0) {
      body = `Uploading ${status.pendingUploads} items`;
    } else {
      body = "Processing...";
    }

    await this.sendProgressNotification(title, body, overallProgress, 100);
  }

  private async sendInstantNotification(
    title: string,
    body: string,
    importance: Notifications.AndroidImportance = Notifications.AndroidImportance.DEFAULT,
    dismissible: boolean = true,
  ) {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      console.warn(
        "Notifications permission not granted, cannot send instant notification.",
      );
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: body,
        sound: "default",
        data: { someData: "goes here" },
        android: {
          channelId: "general-notifications",
          importance: importance,
          sticky: !dismissible,
          autoDismiss: dismissible,
        },
        ios: {
          sound: true,
        },
      },
      trigger: null,
    });
  }

  private async clearNotification(identifier: string) {
    try {
      await Notifications.dismissNotificationAsync(identifier);
      await Notifications.cancelScheduledNotificationAsync(identifier);
    } catch (error) {
      console.warn("Failed to dismiss/cancel notification:", error);
    }
  }

  // --- GLOBAL CLEAR ---
  async clearAllSyncData(): Promise<void> {
    await AsyncStorage.multiRemove([
      this.PENDING_UPLOADS_KEY,
      this.PENDING_DOWNLOADS_KEY,
      this.OFFLINE_IMAGES_KEY,
      this.LAST_SYNC_KEY,
    ]);
    this.pendingUploadsCache = [];
    this.pendingDownloadsCache = [];
    this.offlineImagesCache = {};
    this.imageSyncStatesCache.clear();

    try {
      const offlineImagesDir = UrlHelper.joinPaths(
        FileSystem.documentDirectory || "",
        "offline_images",
      );
      const dirInfo = await FileSystem.getInfoAsync(offlineImagesDir);
      if (dirInfo.exists && dirInfo.isDirectory) {
        await FileSystem.deleteAsync(offlineImagesDir, { idempotent: true });
        console.log("Cleared offline_images directory.");
      }
    } catch (e) {
      console.warn("Failed to clear offline_images directory:", e);
    }
    await imageCacheService.clearCache();

    await this.updateGlobalSyncStatus();
    await this.clearNotification(this.SYNC_NOTIFICATION_IDENTIFIER);
  }
}

export const syncService = new SyncService();
