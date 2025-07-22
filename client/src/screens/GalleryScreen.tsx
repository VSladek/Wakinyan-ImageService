"use client"

import React from "react"
import { useState, useEffect, useCallback, useMemo, useContext } from "react"
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  Dimensions,
  Image,
  StatusBar,
  ActivityIndicator,
  Platform,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import * as ImagePicker from "expo-image-picker"
import { Galeria } from "@nandorojo/galeria"
import { apiService } from "../services/api"
import { syncService, type SyncStatus } from "../services/syncService"
import { imageCacheService } from "../services/imageCacheService"
// Import the updated types from your `types/api.ts` and my custom types
import type {
  Image as ImageType,
  Album,
  LocalImage,
  GalleryImage,
  ImageSyncState,
} from "../types/api"
import Svg, { Circle } from "react-native-svg"
import "react-native-get-random-values" // Required for uuid v4 if not already imported globally
import { v4 as uuidv4 } from "uuid" // For generating temporary unique IDs
import { GaleriaContext } from "@nandorojo/galeria/build/context"

interface GalleryScreenProps {
  navigation: any
  route: {
    params: {
      album: Album
    }
  }
}

const { width } = Dimensions.get("window")
const imageSize = (width - 16) / 3

// Circular Progress Component (same as before)
const CircularProgress: React.FC<{ progress: number; color: string }> = ({
  progress,
  color,
}) => {
  const radius = 10
  const strokeWidth = 2.5
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <View style={styles.circularProgressContainer}>
      <Svg width={radius * 2} height={radius * 2}>
        <Circle
          stroke="#e6e6e6"
          fill="none"
          cx={radius}
          cy={radius}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <Circle
          stroke={color}
          fill="none"
          cx={radius}
          cy={radius}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          originX={radius}
          originY={radius}
        />
      </Svg>
      <Text style={[styles.progressText, { color }]}>
        {Math.round(progress)}%
      </Text>
    </View>
  )
}

// --- REVISED COMPONENT: GalleryImageTile ---

interface GalleryImageTileProps {
  item: GalleryImage
  index: number
  isSelectionMode: boolean
  isSelected: boolean
  displayUri?: string
  syncState?: ImageSyncState
  localUploadState?: { progress: number; status: LocalImage["status"] }
  onToggleSelection: (id: string | number) => void
  onStartSelection: (id: string | number) => void
}

const GalleryImageTile: React.FC<GalleryImageTileProps> = ({
  item,
  index,
  isSelectionMode,
  isSelected,
  displayUri,
  syncState,
  localUploadState,
  onToggleSelection,
  onStartSelection,
}) => {
  // 1. Call useContext at the top level of the component, as required by React.
  const { setOpen } = useContext(GaleriaContext)

  const isLocalUpload = "localId" in item
  const selectableId =
    "id" in item && item.id !== -1 ? item.id : item.localId

  const showBigUploadProgress =
    isLocalUpload && localUploadState?.status === "local-uploading"
  const isBeingDownloaded = syncState?.isDownloading
  const isBeingUploaded = syncState?.isUploading

  const smallProgress = isBeingDownloaded
    ? syncState?.downloadProgress || 0
    : isBeingUploaded
      ? syncState?.uploadProgress || 0
      : 0
  const smallProgressColor = isBeingDownloaded ? "#007AFF" : "#FF9500"

  return (
    <TouchableOpacity
      activeOpacity={isSelectionMode ? 0.7 : 1}
      style={[
        styles.imageContainer,
        isSelected && styles.selectedImageContainer,
        index % 3 !== 2 && styles.imageSpacing,
      ]}
      onLongPress={() => {
        if (!isSelectionMode) {
          onStartSelection(selectableId)
        }
      }}
      onPress={() => {
        if (isSelectionMode) onToggleSelection(selectableId)
      }}
    >
      {showBigUploadProgress ? (
        <View style={[styles.image, styles.uploadingOverlay]}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.uploadProgressText}>
            {Math.round(localUploadState?.progress || 0)}%
          </Text>
        </View>
      ) : displayUri ? (
        <Galeria.Image index={index}>
          <Image
            source={{ uri: displayUri }}
            style={styles.image}
            resizeMode="cover"
          />
        </Galeria.Image>
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <ActivityIndicator size="small" color="#007AFF" />
        </View>
      )}

      {/* Status indicators (no changes) */}
      {!showBigUploadProgress && (
        <View style={styles.statusOverlay}>{/* ... all status icons */}</View>
      )}

      {/* Selection overlay (no changes) */}
      {isSelectionMode && (
        <View style={styles.selectionOverlay}>
          <View
            style={[
              styles.selectionCircle,
              isSelected && styles.selectedCircle,
            ]}
          >
            {isSelected && (
              <Ionicons name="checkmark" size={14} color="#fff" />
            )}
          </View>
        </View>
      )}
    </TouchableOpacity>
  )
}

export const GalleryScreen: React.FC<GalleryScreenProps> = ({
  navigation,
  route,
}) => {
  const { album } = route.params
  // images state now holds both ImageType (from server) and LocalImage (optimistic uploads)
  const [images, setImages] = useState<GalleryImage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  // `imageSyncStates` specifically for server images (keyed by server ID)
  const [imageSyncStates, setImageSyncStates] = useState<
    Record<number, ImageSyncState>
  >({})
  // `localUploadProgresses` for optimistic local images (keyed by localId)
  const [localUploadProgresses, setLocalUploadProgresses] = useState<
    Record<string, { progress: number; status: LocalImage["status"] }>
  >({})
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedImages, setSelectedImages] = useState<Set<string | number>>(
    new Set(),
  )
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Pre-resolved URIs for both display and Galeria
  const [resolvedUris, setResolvedUris] = useState<
    Map<string | number, string>
  >(new Map())

  // Helper function to resolve the best URI for an image
  const resolveImageUri = useCallback(
    async (
      item: GalleryImage,
      syncState?: ImageSyncState,
    ): Promise<string> => {
      // For LocalImage, use the local URI directly
      if ("localId" in item) {
        return item.localUri
      }

      // For server images (ImageType)
      const serverImage = item as ImageType

      // Priority 1: Downloaded offline image
      if (syncState?.isDownloaded && syncState.localUri) {
        return syncState.localUri
      }

      // Priority 2: Cached image from viewer cache
      const networkUrl = apiService.getImageUrl(serverImage.filename)
      try {
        const cachedUri = await imageCacheService.getCachedImageUri(
          networkUrl,
          serverImage.id,
        )
        if (cachedUri) {
          return cachedUri
        }
      } catch (error) {
        console.warn(
          `Failed to get cached URI for image ${serverImage.id}:`,
          error,
        )
      }

      // Priority 3: Network URL as fallback
      return networkUrl
    },
    [],
  )

  // Pre-resolve all URIs when images or sync states change
  useEffect(() => {
    const resolveAllUris = async () => {
      if (images.length === 0) {
        setResolvedUris(new Map())
        return
      }

      const newResolvedUris = new Map<string | number, string>()

      // Resolve URIs for all images in parallel
      const resolutionPromises = images.map(async (item) => {
        const id = "id" in item && item.id !== -1 ? item.id : item.localId
        const syncState =
          "id" in item && item.id !== -1 ? imageSyncStates[item.id] : undefined

        try {
          const resolvedUri = await resolveImageUri(item, syncState)
          newResolvedUris.set(id, resolvedUri)
        } catch (error) {
          console.warn(`Failed to resolve URI for image ${id}:`, error)
          // Fallback to network URL or local URI
          if ("localId" in item) {
            newResolvedUris.set(id, item.localUri)
          } else {
            newResolvedUris.set(id, apiService.getImageUrl(item.filename))
          }
        }
      })

      await Promise.all(resolutionPromises)
      setResolvedUris(newResolvedUris)
    }

    resolveAllUris()
  }, [images, imageSyncStates, resolveImageUri])

  // Memoized Galeria URLs - now using pre-resolved URIs
  const galeriaUrls = useMemo(() => {
    if (images.length === 0) return []

    return images.map((img) => {
      const id = "id" in img && img.id !== -1 ? img.id : img.localId
      const resolvedUri = resolvedUris.get(id)

      if (resolvedUri) {
        return resolvedUri
      }

      // Fallback if not resolved yet
      if ("localId" in img) {
        return img.localUri
      } else {
        return apiService.getImageUrl(img.filename)
      }
    })
  }, [images, resolvedUris])

  // Function to load images from server and initialize sync states
  const loadImages = useCallback(async () => {
    try {
      setIsRefreshing(true)
      const response = await apiService.getAlbumImages(album.id)
      const fetchedImages: ImageType[] = response.images || []

      // Update `images` state: Merge fetched server images with any pending local uploads
      setImages((prevImages) => {
        const newImagesMap = new Map<string | number, GalleryImage>()

        // Add fetched images first
        fetchedImages.forEach((img) => {
          newImagesMap.set(img.id, img)
        })

        // Add back existing local images IF they haven't been replaced by a server image
        prevImages.forEach((prevImg) => {
          if ("localId" in prevImg) {
            // It's a LocalImage
            // Check if a fetched image with the same filename exists (implies successful upload)
            const isReplacedByServerImage = fetchedImages.some(
              (fetchedImg) => fetchedImg.filename === prevImg.filename,
            )
            if (!isReplacedByServerImage) {
              newImagesMap.set(prevImg.localId, prevImg) // Keep the local image
            } else {
              // This local image has been replaced, clean up its local state
              setLocalUploadProgresses((prev) => {
                const next = { ...prev }
                delete next[prevImg.localId] // Remove completed local upload state
                return next
              })
            }
          }
        })

        const updatedImages = Array.from(newImagesMap.values())

        // Sort: pending uploads first, then server images by creation date (newest first)
        return updatedImages.sort((a, b) => {
          const aIsLocal = "localId" in a
          const bIsLocal = "localId" in b

          if (aIsLocal && !bIsLocal) return -1 // Local first
          if (!aIsLocal && bIsLocal) return 1 // Server after local

          // For both local or both server, sort by created_at (most recent first)
          const aTime = new Date(a.created_at || 0).getTime()
          const bTime = new Date(b.created_at || 0).getTime()
          return bTime - aTime
        })
      })

      // Initialize sync states for server images
      const initialSyncStates: Record<number, ImageSyncState> = {}
      for (const image of fetchedImages) {
        const syncState = await syncService.getImageSyncState(image.id)
        initialSyncStates[image.id] = syncState
      }
      setImageSyncStates(initialSyncStates)
    } catch (error) {
      console.error("Failed to load images:", error)
      Alert.alert("Error", "Failed to load images")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [album.id])

  // Effect to load data on mount
  useEffect(() => {
    loadImages()
  }, [refreshTrigger])

  // Effect to subscribe to sync service updates
  useEffect(() => {
    // Subscribe to global sync status updates
    const unsubscribeSyncStatus = syncService.addSyncStatusListener(
      (status) => {
        setSyncStatus(status)
      },
    )

    return () => {
      unsubscribeSyncStatus()
    }
  }, [])

  // Separate effect for image sync state listeners
  useEffect(() => {
    const serverImages = images.filter(
      (img) => "id" in img && img.id !== -1,
    ) as ImageType[]

    const updateImageState = (imageId: number, state: ImageSyncState) => {
      setImageSyncStates((prev) => {
        if (JSON.stringify(prev[imageId]) === JSON.stringify(state)) {
          return prev // No change needed
        }
        return { ...prev, [imageId]: state }
      })
    }

    // Set up listeners for current server images
    const imageListenersCleanup: (() => void)[] = []
    serverImages.forEach((img) => {
      imageListenersCleanup.push(
        syncService.addImageSyncStateListener(img.id, updateImageState),
      )
    })

    return () => {
      imageListenersCleanup.forEach((unsub) => unsub())
    }
  }, [images.length])

  // Optimized effect for local upload progress
  useEffect(() => {
    const localImages = images.filter(
      (img) => "localId" in img,
    ) as LocalImage[]

    if (localImages.length === 0) {
      return // No local images to track
    }

    const updateLocalUploadProgress = () => {
      // Access syncService's internal cache
      const currentPendingUploads = (syncService as any).pendingUploadsCache

      setLocalUploadProgresses((prevStates) => {
        const newStates = { ...prevStates }
        let didChange = false

        localImages.forEach((img) => {
          const pendingUpload = currentPendingUploads.find(
            (pu: any) => pu.tempLocalImageId === img.localId,
          )
          const currentLocalState = prevStates[img.localId]

          if (pendingUpload) {
            // Update progress and status based on pendingUpload state
            if (
              !currentLocalState ||
              currentLocalState.progress !== pendingUpload.progress ||
              currentLocalState.status !== pendingUpload.status
            ) {
              newStates[img.localId] = {
                progress: pendingUpload.progress,
                status: pendingUpload.status,
              }
              didChange = true
            }
          } else if (
            currentLocalState &&
            currentLocalState.status !== "local-upload-failed"
          ) {
            // Upload completed or removed from queue
            if (
              currentLocalState.progress !== 100 ||
              currentLocalState.status !== "local-upload-completed"
            ) {
              newStates[img.localId] = {
                progress: 100,
                status: "local-upload-completed",
              }
              didChange = true
            }
          }
        })

        return didChange ? newStates : prevStates
      })
    }

    const interval = setInterval(updateLocalUploadProgress, 1000)
    return () => clearInterval(interval)
  }, [images.filter((img) => "localId" in img).length])

  const performSync = useCallback(async () => {
    Alert.alert("Syncing...", "Processing pending downloads and uploads.", [
      { text: "OK" },
    ])
    try {
      const result = await syncService.syncAll()
      const totalProcessed =
        result.downloads.success +
        result.downloads.failed +
        result.uploads.success +
        result.uploads.failed
      if (totalProcessed > 0) {
        Alert.alert(
          "Sync Complete",
          `Downloads: ${result.downloads.success} success, ${result.downloads.failed} failed.\nUploads: ${result.uploads.success} success, ${result.uploads.failed} failed.`,
        )
      } else {
        Alert.alert("Sync Complete", "No new items to sync.")
      }
      setRefreshTrigger((prev) => prev + 1)
    } catch (error) {
      Alert.alert("Sync Failed", "An error occurred during sync.")
      console.error("Sync failed:", error)
    }
  }, [])

  const handleRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1)
  }, [])

  const uploadImages = async () => {
    const { status: mediaLibraryStatus } =
      await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (mediaLibraryStatus !== "granted") {
      Alert.alert("Permission needed", "Please grant gallery access")
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "livePhotos", "videos"],
      allowsMultipleSelection: true,
      exif: true,
    })

    if (!result.canceled && result.assets) {
      const newLocalImages: LocalImage[] = []

      for (const asset of result.assets) {
        const tempLocalId = uuidv4()
        const filename = asset.uri.split("/").pop() || `${tempLocalId}.jpg`

        const newLocalImage: LocalImage = {
          id: -1,
          localId: tempLocalId,
          localUri: asset.uri,
          filename: filename,
          status: "local-pending-upload",
          created_at: new Date().toISOString(),
          uploadProgress: 0,
          file_size: asset.fileSize || undefined,
          width: asset.width || undefined,
          height: asset.height || undefined,
        }

        newLocalImages.push(newLocalImage)

        setLocalUploadProgresses((prev) => ({
          ...prev,
          [tempLocalId]: { progress: 0, status: "local-pending-upload" },
        }))

        try {
          await syncService.queueUpload(
            album.id,
            asset.uri,
            tempLocalId,
            asset.fileSize || undefined,
            asset.width || undefined,
            asset.height || undefined,
            asset.creationTime
              ? new Date(asset.creationTime).toISOString()
              : undefined,
          )
        } catch (error) {
          console.error("Failed to queue upload for asset:", asset.uri, error)
          setLocalUploadProgresses((prev) => ({
            ...prev,
            [tempLocalId]: { progress: 0, status: "local-upload-failed" },
          }))
        }
      }

      setImages((prev) => [...newLocalImages, ...prev])
      Alert.alert(
        "Upload Queued",
        `${newLocalImages.length} images queued for upload. Tap 'Sync Now' to begin.`,
      )
    }
  }

  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode((prev) => !prev)
    setSelectedImages(new Set())
  }, [])

  const toggleImageSelection = useCallback((id: string | number) => {
    setSelectedImages((prev) => {
      const newSelection = new Set(prev)
      if (newSelection.has(id)) {
        newSelection.delete(id)
      } else {
        newSelection.add(id)
      }
      return newSelection
    })
  }, [])

  const selectAllImages = useCallback(() => {
    if (selectedImages.size === images.length && images.length > 0) {
      setSelectedImages(new Set())
    } else {
      setSelectedImages(
        new Set(
          images.map((img) =>
            "id" in img && img.id !== -1 ? img.id : img.localId,
          ),
        ),
      )
    }
  }, [selectedImages.size, images])

  const downloadSelectedImages = useCallback(async () => {
    if (selectedImages.size === 0) return

    const selectedImagesList = images.filter((img) => {
      const idToFilter = "id" in img && img.id !== -1 ? img.id : img.localId
      return selectedImages.has(idToFilter)
    })

    let queuedCount = 0
    for (const image of selectedImagesList) {
      if ("id" in image && image.id !== -1) {
        try {
          await syncService.queueDownload(
            image.id,
            image.filename,
            album.name,
            album.id,
          )
          queuedCount++
        } catch (error) {
          console.error("Failed to queue download for image:", image.id, error)
        }
      } else {
        console.warn(
          "Skipping download for local-only image:",
          (image as LocalImage).localId,
        )
      }
    }

    Alert.alert(
      "Queued",
      `${queuedCount} images queued for download. Tap 'Sync Now' to start.`,
    )
    setIsSelectionMode(false)
    setSelectedImages(new Set())
  }, [selectedImages, images, album.name, album.id])

  const syncWholeAlbum = useCallback(async () => {
    const serverImagesCount = images.filter(
      (img) => "id" in img && img.id !== -1,
    ).length
    Alert.alert(
      "Sync Album",
      `Download all ${serverImagesCount} server images from "${album.name}" to your device for offline access?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Download",
          onPress: async () => {
            try {
              const serverImages = images.filter(
                (img) => "id" in img && img.id !== -1,
              ) as ImageType[]
              await syncService.queueAlbumDownload(
                album.id,
                album.name,
                serverImages,
              )
              Alert.alert(
                "Queued",
                `${serverImages.length} images queued for download. Tap 'Sync Now' to start.`,
              )
            } catch (error) {
              Alert.alert("Error", "Failed to queue album download")
              console.error("Error queuing album download:", error)
            }
          },
        },
      ],
    )
  }, [images, album.id, album.name])

  // Effect to set header options
  useEffect(() => {
    navigation.setOptions({
      title: album.name,
      headerStyle: {
        backgroundColor: isSelectionMode ? "#007AFF" : "#fff",
      },
      headerTintColor: isSelectionMode ? "#fff" : "#000",
      headerTitleStyle: {
        fontWeight: "600",
      },
      headerRight: () => (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {!isSelectionMode ? (
            <>
              <TouchableOpacity
                onPress={syncWholeAlbum}
                style={styles.headerButton}
              >
                <Ionicons
                  name="cloud-download-outline"
                  size={22}
                  color="#007AFF"
                />
              </TouchableOpacity>
              {syncStatus &&
                (syncStatus.pendingUploads > 0 ||
                  syncStatus.pendingDownloads > 0) && (
                  <TouchableOpacity
                    onPress={performSync}
                    style={styles.headerButton}
                  >
                    <Ionicons name="sync" size={20} color="#007AFF" />
                  </TouchableOpacity>
                )}
            </>
          ) : (
            <TouchableOpacity
              onPress={selectAllImages}
              style={styles.headerButton}
            >
              <Text style={[styles.headerButtonText, { color: "#fff" }]}>
                {selectedImages.size === images.length ? "None" : "All"}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={toggleSelectionMode}
            style={styles.headerButton}
          >
            <Text
              style={[
                styles.headerButtonText,
                { color: isSelectionMode ? "#fff" : "#007AFF" },
              ]}
            >
              {isSelectionMode ? "Cancel" : "Select"}
            </Text>
          </TouchableOpacity>
        </View>
      ),
    })
  }, [
    album.name,
    navigation,
    isSelectionMode,
    syncStatus?.pendingUploads,
    syncStatus?.pendingDownloads,
    selectedImages.size,
    images.length,
    syncWholeAlbum,
    performSync,
    selectAllImages,
    toggleSelectionMode,
  ])

  // Simplified renderItem - no more complex URI resolution needed
  const renderItem = useCallback(
    ({ item, index }: { item: GalleryImage; index: number }) => {
      const selectableId =
        "id" in item && item.id !== -1 ? item.id : item.localId
      const isSelected = selectedImages.has(selectableId)
      const displayUri = resolvedUris.get(selectableId)
      const syncState =
        "id" in item && item.id !== -1 ? imageSyncStates[item.id] : undefined
      const localUploadState =
        "localId" in item ? localUploadProgresses[item.localId] : undefined

      return (
        <GalleryImageTile
          item={item}
          index={index}
          isSelectionMode={isSelectionMode}
          isSelected={isSelected}
          displayUri={displayUri}
          syncState={syncState}
          localUploadState={localUploadState}
          onToggleSelection={toggleImageSelection}
          onStartSelection={(id) => {
            setIsSelectionMode(true)
            toggleImageSelection(id)
          }}
        />
      )
    },
    [
      isSelectionMode,
      selectedImages,
      resolvedUris,
      imageSyncStates,
      localUploadProgresses,
      toggleImageSelection,
    ],
  )

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading images...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={isSelectionMode ? "light-content" : "dark-content"}
        backgroundColor={isSelectionMode ? "#007AFF" : "#fff"}
      />

      {/* Sync Status Bar */}
      {syncStatus &&
        (syncStatus.pendingUploads > 0 ||
          syncStatus.pendingDownloads > 0) &&
        !isSelectionMode && (
          <View style={styles.syncStatusBar}>
            <View style={styles.syncStatusContent}>
              <Ionicons name="sync-outline" size={16} color="#007AFF" />
              <Text style={styles.syncStatusText}>
                {syncStatus.pendingDownloads > 0 &&
                  `${syncStatus.pendingDownloads} downloading`}
                {syncStatus.pendingDownloads > 0 &&
                  syncStatus.pendingUploads > 0 &&
                  " • "}
                {syncStatus.pendingUploads > 0 &&
                  `${syncStatus.pendingUploads} uploading`}
              </Text>
            </View>
            <View style={styles.globalProgressBar}>
              <View
                style={[
                  styles.globalProgressBarFill,
                  {
                    width: `${Math.min(
                      100,
                      (syncStatus.overallDownloadProgress +
                        syncStatus.overallUploadProgress) /
                        2,
                    )}%`,
                  },
                ]}
              />
            </View>
            <TouchableOpacity onPress={performSync} style={styles.syncButton}>
              <Text style={styles.syncButtonText}>Sync Now</Text>
            </TouchableOpacity>
          </View>
        )}

      {/* Storage Info */}
      {syncStatus && syncStatus.offlineImagesCount > 0 && (
        <View style={styles.storageInfo}>
          <Ionicons name="phone-portrait" size={14} color="#666" />
          <Text style={styles.storageText}>
            {syncStatus.offlineImagesCount} offline images •{" "}
            {syncService.formatStorageSize(syncStatus.totalOfflineSize)}
          </Text>
        </View>
      )}

      <Galeria urls={galeriaUrls}>
        <FlatList
          data={images}
          keyExtractor={(item) =>
            "id" in item && item.id !== -1 ? item.id.toString() : item.localId
          }
          renderItem={renderItem}
          numColumns={3}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
            />
          }
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="images-outline" size={48} color="#666" />
              <Text style={styles.emptyText}>
                This album doesn't have any images yet.
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={uploadImages}
              >
                <Text style={styles.emptyButtonText}>Add Images</Text>
              </TouchableOpacity>
            </View>
          }
        />
      </Galeria>

      {/* Selection Toolbar */}
      {isSelectionMode && (
        <View style={styles.selectionToolbar}>
          <Text style={styles.selectionCount}>
            {selectedImages.size} selected
          </Text>
          <View style={styles.toolbarActions}>
            <TouchableOpacity
              style={[
                styles.downloadButton,
                selectedImages.size === 0 && styles.downloadButtonDisabled,
              ]}
              onPress={downloadSelectedImages}
              disabled={selectedImages.size === 0}
            >
              <Ionicons
                name="download-outline"
                size={16}
                color={selectedImages.size === 0 ? "#ccc" : "#007AFF"}
              />
              <Text
                style={[
                  styles.downloadButtonText,
                  selectedImages.size === 0 &&
                    styles.downloadButtonTextDisabled,
                ]}
              >
                Download
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Floating Action Buttons */}
      {!isSelectionMode && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[
              styles.fab,
              syncStatus?.syncInProgress && styles.fabDisabled,
            ]}
            onPress={uploadImages}
            disabled={syncStatus?.syncInProgress}
          >
            {syncStatus?.syncInProgress ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="add" size={24} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  headerButton: {
    marginLeft: 16,
    padding: 4,
  },
  headerButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  syncStatusBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#e7f0fa",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#d3e0f0",
  },
  syncStatusContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  syncStatusText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "500",
  },
  globalProgressBar: {
    height: 4,
    backgroundColor: "#cce0ff",
    borderRadius: 2,
    flex: 1,
    marginHorizontal: 10,
    overflow: "hidden",
  },
  globalProgressBarFill: {
    height: "100%",
    backgroundColor: "#007AFF",
    borderRadius: 2,
  },
  syncButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  syncButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  storageInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    backgroundColor: "#f8f9fa",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  storageText: {
    marginLeft: 6,
    fontSize: 12,
    color: "#666",
  },
  listContainer: {
    padding: 4,
  },
  imageContainer: {
    width: imageSize,
    height: imageSize,
    marginBottom: 4,
    borderRadius: 2,
    overflow: "hidden",
    position: "relative",
  },
  imageSpacing: {
    marginRight: 4,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#e0e0e0",
  },
  uploadingOverlay: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: "100%",
  },
  uploadProgressText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 8,
  },
  statusOverlay: {
    position: "absolute",
    top: 4,
    right: 4,
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
  },
  statusBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0.5 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  pendingBadge: {
    backgroundColor: "rgba(255, 149, 0, 0.15)",
  },
  errorBadge: {
    backgroundColor: "rgba(255, 59, 48, 0.15)",
  },
  circularProgressContainer: {
    position: "relative",
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0.5 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  progressText: {
    position: "absolute",
    fontSize: 7,
    fontWeight: "bold",
  },
  selectedImageContainer: {
    borderWidth: 2,
    borderColor: "#007AFF",
  },
  selectionOverlay: {
    position: "absolute",
    top: 4,
    left: 4,
    zIndex: 1,
  },
  selectionCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#fff",
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  selectedCircle: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    marginTop: 12,
    marginBottom: 20,
    textAlign: "center",
    marginHorizontal: 20,
  },
  emptyButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 16,
  },
  emptyButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  selectionToolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingBottom: Platform.OS === "ios" ? 25 : 12,
  },
  selectionCount: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  toolbarActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButtons: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 30 : 20,
    right: 20,
    alignItems: "flex-end",
    gap: 12,
  },
  downloadButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e0f2ff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  downloadButtonDisabled: {
    opacity: 0.6,
    backgroundColor: "#f0f0f0",
  },
  downloadButtonText: {
    marginLeft: 4,
    color: "#007AFF",
    fontSize: 12,
    fontWeight: "500",
  },
  downloadButtonTextDisabled: {
    color: "#999",
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  fabDisabled: {
    opacity: 0.6,
    backgroundColor: "#a0cfff",
  },
})
