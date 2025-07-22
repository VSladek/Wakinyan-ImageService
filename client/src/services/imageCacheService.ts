import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { UrlHelper } from "../utils/urlHelpers";

class ImageCacheService {
  private readonly CACHE_DIR = UrlHelper.joinPaths(
    FileSystem.cacheDirectory || "",
    "image_viewer_cache",
  );
  private readonly IMAGE_CACHE_MAP_KEY = "imageCacheMap";

  private cacheMap: Map<string, string> = new Map();

  constructor() {
    this.init();
  }

  private async init() {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.CACHE_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.CACHE_DIR, {
          intermediates: true,
        });
      }
    } catch (error) {
      console.error("Failed to ensure image cache directory exists:", error);
    }

    try {
      const storedMap = await AsyncStorage.getItem(this.IMAGE_CACHE_MAP_KEY);
      if (storedMap) {
        this.cacheMap = new Map(JSON.parse(storedMap));
      }
    } catch (error) {
      console.error("Failed to load image cache map from AsyncStorage:", error);
    }
  }

  private async saveCacheMap() {
    try {
      await AsyncStorage.setItem(
        this.IMAGE_CACHE_MAP_KEY,
        JSON.stringify(Array.from(this.cacheMap.entries())),
      );
    } catch (error) {
      console.error("Failed to save image cache map to AsyncStorage:", error);
    }
  }

  async getCachedImageUri(
    networkUrl: string,
    imageId: number,
  ): Promise<string | null> {
    if (!networkUrl || !imageId) {
      console.warn("Invalid input for getCachedImageUri:", {
        networkUrl,
        imageId,
      });
      return null;
    }

    const filenameFromUrl = networkUrl.split("/").pop();
    const fileExtension = filenameFromUrl
      ? filenameFromUrl.split(".").pop()
      : "jpg";
    const localFilename = `${imageId}.${fileExtension}`;
    const localUri = UrlHelper.joinPaths(this.CACHE_DIR, localFilename);

    if (this.cacheMap.has(networkUrl)) {
      const cachedLocalUri = this.cacheMap.get(networkUrl)!;
      const fileInfo = await FileSystem.getInfoAsync(cachedLocalUri);
      if (fileInfo.exists) {
        return cachedLocalUri;
      } else {
        console.warn(
          `Cached file ${cachedLocalUri} missing on disk for ${networkUrl}. Re-downloading.`,
        );
        this.cacheMap.delete(networkUrl);
        await this.saveCacheMap();
      }
    }

    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (fileInfo.exists) {
      this.cacheMap.set(networkUrl, localUri);
      await this.saveCacheMap();
      return localUri;
    }

    try {
      console.log(`Downloading ${networkUrl} to viewer cache...`);
      const { uri, status } = await FileSystem.downloadAsync(
        networkUrl,
        localUri,
      );
      if (status === 200 && uri) {
        this.cacheMap.set(networkUrl, uri);
        await this.saveCacheMap();
        return uri;
      } else {
        console.error(
          `Failed to download ${networkUrl} for viewer cache. Status: ${status}`,
        );
        await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(
          (e) => console.error("Failed to delete partial cache:", e),
        );
        return null;
      }
    } catch (error) {
      console.error(`Error caching image ${networkUrl}:`, error);
      await FileSystem.deleteAsync(localUri, { idempotent: true }).catch((e) =>
        console.error("Failed to delete partial cache:", e),
      );
      return null;
    }
  }

  async clearCache(): Promise<void> {
    try {
      await FileSystem.deleteAsync(this.CACHE_DIR, { idempotent: true });
      await FileSystem.makeDirectoryAsync(this.CACHE_DIR, {
        intermediates: true,
      });
      this.cacheMap.clear();
      await this.saveCacheMap();
      console.log("Image viewer cache cleared.");
    } catch (error) {
      console.error("Failed to clear image viewer cache:", error);
    }
  }

  async getCacheSize(): Promise<number> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.CACHE_DIR);
      if (dirInfo.exists && dirInfo.isDirectory) {
        const files = await FileSystem.readDirectoryAsync(this.CACHE_DIR);
        let totalSize = 0;
        for (const file of files) {
          const fileInfo = await FileSystem.getInfoAsync(
            UrlHelper.joinPaths(this.CACHE_DIR, file),
          );
          if (fileInfo.exists && !fileInfo.isDirectory) {
            totalSize += fileInfo.size || 0;
          }
        }
        return totalSize;
      }
    } catch (error) {
      console.error("Failed to get cache size:", error);
    }
    return 0;
  }
}

export const imageCacheService = new ImageCacheService();
