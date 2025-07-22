import type React from "react"
import { useState, useEffect } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Alert, RefreshControl, ScrollView, Modal } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import * as ImagePicker from "expo-image-picker"
import { ImageGrid } from "../components/ImageGrid"
import { apiService } from "../services/api"
import { enhancedSyncService } from "../services/enhancedSyncService"
import { offlineService } from "../services/offlineService"
import type { Image as ImageType, Album } from "../types/api"
import { useAuth } from "../contexts/AuthContext"

interface EnhancedGalleryScreenProps {
  navigation: any
  route: {
    params: {
      album: Album
    }
  }
}

export const EnhancedGalleryScreen: React.FC<EnhancedGalleryScreenProps> = ({ navigation, route }) => {
  const { album } = route.params
  const { user } = useAuth()

  const [images, setImages] = useState<ImageType[]>([])
  const [offlineImages, setOfflineImages] = useState<ImageType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set())
  const [showOfflineOnly, setShowOfflineOnly] = useState(false)
  const [syncStatus, setSyncStatus] = useState<any>(null)
  const [showSyncModal, setShowSyncModal] = useState(false)

  useEffect(() => {
    navigation.setOptions({
      title: album.name,
      headerStyle: { backgroundColor: "#fff" },
      headerTintColor: "#000",
      headerRight: () => (
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={() => setShowSyncModal(true)} style={styles.headerButton}>
            <Ionicons name="stats-chart" size={20} color="#007AFF" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowOfflineOnly(!showOfflineOnly)} style={styles.headerButton}>
            <Ionicons
              name={showOfflineOnly ? "cloud" : "phone-portrait"}
              size={20}
              color={showOfflineOnly ? "#007AFF" : "#666"}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={toggleSelectionMode} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>{isSelectionMode ? "Cancel" : "Select"}</Text>
          </TouchableOpacity>
        </View>
      ),
    })

    loadData()
  }, [album, navigation, isSelectionMode, showOfflineOnly])

  const loadData = async () => {
    try {
      // Load online images
      const response = await apiService.getAlbumImages(album.id)
      setImages(response.images || [])

      // Load offline images
      const offline = await offlineService.getOfflineImagesForAlbum(album.id)
      setOfflineImages(
        offline.map((img) => ({
          id: img.id,
          filename: img.filename,
          album_id: img.albumId,
          status: "approved" as const,
          created_at: new Date(img.downloadedAt).toISOString(),
        })),
      )

      // Load sync status
      const status = await enhancedSyncService.getSyncStatus()
      setSyncStatus(status)
    } catch (error) {
      Alert.alert("Error", "Failed to load images")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    loadData()
  }

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode)
    setSelectedImages(new Set())
  }

  const handleImageSelect = (imageId: number) => {
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

    const imagesToDownload = images.filter((img) => selectedImages.has(img.id))

    for (const image of imagesToDownload) {
      await enhancedSyncService.queueImageDownload(image.id, image.filename, album.name, album.id)
    }

    Alert.alert("Queued", `${selectedImages.size} images queued for download`)
    setIsSelectionMode(false)
    setSelectedImages(new Set())

    // Start sync
    enhancedSyncService.syncAll()
    loadData()
  }

  const downloadEntireAlbum = async () => {
    Alert.alert("Download Album", `Download all ${images.length} images from "${album.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Download",
        onPress: async () => {
          await enhancedSyncService.queueAlbumDownload(album.id, album.name, images)
          Alert.alert("Queued", `${images.length} images queued for download`)
          enhancedSyncService.syncAll()
          loadData()
        },
      },
    ])
  }

  const uploadImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant gallery access")
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 50,
    })

    if (!result.canceled && result.assets) {
      // Handle upload logic here
      Alert.alert("Upload", `${result.assets.length} images selected for upload`)
    }
  }

  const displayImages = showOfflineOnly ? offlineImages : images

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        {/* Status Bar */}
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>
            {showOfflineOnly ? "Offline" : "Online"} • {displayImages.length} images
          </Text>

          {syncStatus?.syncInProgress && (
            <View style={styles.syncIndicator}>
              <Ionicons name="sync" size={16} color="#007AFF" />
              <Text style={styles.syncText}>Syncing...</Text>
            </View>
          )}
        </View>

        <ImageGrid
          images={displayImages}
          onImagePress={(image, index) => {
            navigation.navigate("ImageDetail", {
              images: displayImages,
              initialIndex: index,
              albumName: album.name,
              onImageUpdate: loadData,
            })
          }}
          onImageLongPress={() => {
            if (!isSelectionMode) {
              setIsSelectionMode(true)
            }
          }}
          isSelectionMode={isSelectionMode}
          selectedImages={selectedImages}
          onImageSelect={handleImageSelect}
          showSyncIndicators={!showOfflineOnly}
        />
      </ScrollView>

      {/* Selection Toolbar */}
      {isSelectionMode && (
        <View style={styles.selectionToolbar}>
          <Text style={styles.selectionCount}>{selectedImages.size} selected</Text>

          <View style={styles.toolbarButtons}>
            <TouchableOpacity
              style={[styles.toolbarButton, selectedImages.size === 0 && styles.disabledButton]}
              onPress={downloadSelectedImages}
              disabled={selectedImages.size === 0}
            >
              <Ionicons name="download" size={20} color="#007AFF" />
              <Text style={styles.toolbarButtonText}>Download</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Floating Action Buttons */}
      <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.fab} onPress={downloadEntireAlbum}>
          <Ionicons name="cloud-download" size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.fab, styles.uploadFab]} onPress={uploadImages}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Sync Stats Modal */}
      <SyncStatsModal visible={showSyncModal} onClose={() => setShowSyncModal(false)} albumName={album.name} />
    </View>
  )
}

const SyncStatsModal: React.FC<{
  visible: boolean
  onClose: () => void
  albumName: string
}> = ({ visible, onClose, albumName }) => {
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    if (visible) {
      loadStats()
    }
  }, [visible])

  const loadStats = async () => {
    const storageStats = await offlineService.getStorageStats()
    const syncStatus = await enhancedSyncService.getSyncStatus()
    setStats({ storageStats, syncStatus })
  }

  if (!stats) return null

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Storage & Sync</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.statSection}>
            <Text style={styles.statTitle}>Total Storage Used</Text>
            <Text style={styles.statValue}>{offlineService.formatFileSize(stats.storageStats.totalSize)}</Text>
          </View>

          <View style={styles.statSection}>
            <Text style={styles.statTitle}>Downloaded Images</Text>
            <Text style={styles.statValue}>{stats.storageStats.totalImages} images</Text>
          </View>

          <View style={styles.statSection}>
            <Text style={styles.statTitle}>Album Breakdown</Text>
            {stats.storageStats.albumBreakdown.map((album: any) => (
              <View key={album.albumName} style={styles.albumStat}>
                <Text style={styles.albumName}>{album.albumName}</Text>
                <Text style={styles.albumSize}>
                  {album.count} images • {offlineService.formatFileSize(album.size)}
                </Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => {
              Alert.alert("Clear All Data", "This will delete all downloaded images. Continue?", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Clear",
                  style: "destructive",
                  onPress: async () => {
                    await enhancedSyncService.clearAllSyncData()
                    onClose()
                  },
                },
              ])
            }}
          >
            <Text style={styles.clearButtonText}>Clear All Downloaded Data</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollView: {
    flex: 1,
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerButton: {
    marginLeft: 16,
    padding: 4,
  },
  headerButtonText: {
    color: "#007AFF",
    fontSize: 16,
  },
  statusBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#f8f9fa",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  statusText: {
    fontSize: 14,
    color: "#666",
  },
  syncIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  syncText: {
    fontSize: 14,
    color: "#007AFF",
  },
  selectionToolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e9ecef",
  },
  selectionCount: {
    fontSize: 16,
    fontWeight: "500",
  },
  toolbarButtons: {
    flexDirection: "row",
    gap: 12,
  },
  toolbarButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f0f0f0",
    borderRadius: 16,
  },
  disabledButton: {
    opacity: 0.5,
  },
  toolbarButtonText: {
    color: "#007AFF",
    fontSize: 14,
    fontWeight: "500",
  },
  fabContainer: {
    position: "absolute",
    bottom: 20,
    right: 20,
    gap: 12,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  uploadFab: {
    backgroundColor: "#34C759",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  statSection: {
    marginBottom: 24,
  },
  statTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#007AFF",
  },
  albumStat: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  albumName: {
    fontSize: 16,
    fontWeight: "500",
  },
  albumSize: {
    fontSize: 14,
    color: "#666",
  },
  clearButton: {
    backgroundColor: "#FF3B30",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  clearButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
})
