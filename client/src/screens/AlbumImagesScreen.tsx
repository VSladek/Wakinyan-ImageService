import type React from "react"
import { useState, useEffect } from "react"
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
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import * as ImagePicker from "expo-image-picker"
import { apiService } from "../services/api"
import type { Image as ImageType, Album } from "../types/api"
import { useAuth } from "../contexts/AuthContext"
import { syncService } from "../services/syncService"

interface AlbumImagesScreenProps {
  navigation: any
  route: {
    params: {
      album: Album
    }
  }
}

const { width } = Dimensions.get("window")
const imageSize = (width - 32) / 3 // 3 columns instead of 2

export const AlbumImagesScreen: React.FC<AlbumImagesScreenProps> = ({ navigation, route }) => {
  const { album } = route.params
  const [images, setImages] = useState<ImageType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const { user } = useAuth()

  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set())
  const [syncStatus, setSyncStatus] = useState<any>(null)

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode)
    setSelectedImages(new Set())
  }

  const toggleImageSelection = (imageId: number) => {
    const newSelection = new Set(selectedImages)
    if (newSelection.has(imageId)) {
      newSelection.delete(imageId)
    } else {
      newSelection.add(imageId)
    }
    setSelectedImages(newSelection)
  }

  const downloadSelectedImages = async () => {
    if (selectedImages.size === 0) return

    const selectedImagesList = images.filter((img) => selectedImages.has(img.id))

    for (const image of selectedImagesList) {
      await syncService.queueDownload(image.id, image.filename)
    }

    Alert.alert("Success", `${selectedImages.size} images queued for download`)
    setIsSelectionMode(false)
    setSelectedImages(new Set())
    loadSyncStatus()
  }

  const loadSyncStatus = async () => {
    const status = await syncService.getSyncStatus()
    setSyncStatus(status)
  }

  const performSync = async () => {
    try {
      const result = await syncService.syncAll()
      Alert.alert(
        "Sync Complete",
        `Uploads: ${result.uploads.success} success, ${result.uploads.failed} failed\nDownloads: ${result.downloads.success} success, ${result.downloads.failed} failed`,
      )
      loadSyncStatus()
    } catch (error) {
      Alert.alert("Sync Error", "Failed to sync data")
    }
  }

  useEffect(() => {
    loadSyncStatus()
  }, [])

  useEffect(() => {
    navigation.setOptions({ title: album.name })
    loadImages()
  }, [album.name, navigation])

  const loadImages = async () => {
    try {
      const response = await apiService.getAlbumImages(album.id)
      setImages(response.images || [])
    } catch (error) {
      Alert.alert("Error", "Failed to load images")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    loadImages()
  }

  const pickMultipleImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant camera roll permissions")
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 50, // Allow up to 50 images at once
    })

    if (!result.canceled && result.assets) {
      uploadMultipleImages(result.assets.map((asset) => asset.uri))
    }
  }

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant camera permissions")
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0]) {
      uploadMultipleImages([result.assets[0].uri])
    }
  }

  const uploadMultipleImages = async (uris: string[]) => {
    setIsUploading(true)
    let successCount = 0
    let failCount = 0

    for (const uri of uris) {
      try {
        await apiService.uploadImage(album.id, uri)
        successCount++
      } catch (error) {
        failCount++
      }
    }

    Alert.alert(
      "Upload Complete",
      `${successCount} images uploaded successfully${failCount > 0 ? `, ${failCount} failed` : ""}${
        user?.role === "consumer" ? " and pending approval" : ""
      }`,
    )

    loadImages()
    setIsUploading(false)
  }

  const showUploadOptions = () => {
    Alert.alert("Upload Images", "Choose an option", [
      { text: "Camera", onPress: takePhoto },
      { text: "Gallery (Multiple)", onPress: pickMultipleImages },
      { text: "Cancel", style: "cancel" },
    ])
  }

  const renderImage = ({ item }: { item: ImageType }) => (
    <TouchableOpacity
      style={[styles.imageContainer, selectedImages.has(item.id) && styles.selectedImageContainer]}
      onPress={() => {
        if (isSelectionMode) {
          toggleImageSelection(item.id)
        } else {
          navigation.navigate("ImageDetail", { image: item })
        }
      }}
      onLongPress={() => {
        if (!isSelectionMode) {
          setIsSelectionMode(true)
          toggleImageSelection(item.id)
        }
      }}
    >
      <Image source={{ uri: apiService.getImageUrl(item.filename) }} style={styles.image} resizeMode="cover" />
      {item.status === "pending" && (
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingText}>Pending</Text>
        </View>
      )}
      {isSelectionMode && (
        <View style={styles.selectionOverlay}>
          <View style={[styles.selectionCircle, selectedImages.has(item.id) && styles.selectedCircle]}>
            {selectedImages.has(item.id) && <Ionicons name="checkmark" size={16} color="#fff" />}
          </View>
        </View>
      )}
    </TouchableOpacity>
  )

  useEffect(() => {
    navigation.setOptions({
      title: album.name,
      headerRight: () => (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {syncStatus && (syncStatus.pendingUploads > 0 || syncStatus.pendingDownloads > 0) && (
            <TouchableOpacity onPress={performSync} style={{ marginRight: 16, padding: 8 }}>
              <Ionicons name="sync" size={20} color="#007AFF" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={toggleSelectionMode} style={{ marginRight: 16, padding: 8 }}>
            <Text style={{ color: "#007AFF" }}>{isSelectionMode ? "Cancel" : "Select"}</Text>
          </TouchableOpacity>
        </View>
      ),
    })
  }, [album.name, navigation, isSelectionMode, syncStatus])

  return (
    <View style={styles.container}>
      <FlatList
        data={images}
        renderItem={renderImage}
        keyExtractor={(item) => item.id.toString()}
        numColumns={3}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="images-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No images in this album</Text>
          </View>
        }
      />

      {isSelectionMode && (
        <View style={styles.selectionToolbar}>
          <Text style={styles.selectionCount}>{selectedImages.size} selected</Text>
          <TouchableOpacity
            style={[styles.toolbarButton, selectedImages.size === 0 && styles.toolbarButtonDisabled]}
            onPress={downloadSelectedImages}
            disabled={selectedImages.size === 0}
          >
            <Ionicons name="download" size={20} color={selectedImages.size === 0 ? "#ccc" : "#007AFF"} />
            <Text style={[styles.toolbarButtonText, selectedImages.size === 0 && styles.toolbarButtonTextDisabled]}>
              Download
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={[styles.fab, isUploading && styles.fabDisabled]}
        onPress={showUploadOptions}
        disabled={isUploading}
      >
        <Ionicons name={isUploading ? "hourglass" : "camera"} size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  listContainer: {
    padding: 8,
  },
  imageContainer: {
    width: imageSize,
    height: imageSize * 1.2, // Slightly taller for more natural proportions
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  pendingBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(255, 165, 0, 0.9)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pendingText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    marginTop: 16,
  },
  fab: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  fabDisabled: {
    opacity: 0.6,
  },
  selectedImageContainer: {
    borderWidth: 3,
    borderColor: "#007AFF",
  },
  selectionOverlay: {
    position: "absolute",
    top: 8,
    left: 8,
  },
  selectionCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#fff",
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  selectedCircle: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  selectionToolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  selectionCount: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  toolbarButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  toolbarButtonDisabled: {
    opacity: 0.5,
  },
  toolbarButtonText: {
    marginLeft: 4,
    color: "#007AFF",
    fontWeight: "500",
  },
  toolbarButtonTextDisabled: {
    color: "#ccc",
  },
})
