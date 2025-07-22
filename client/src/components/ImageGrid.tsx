"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { View, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator } from "react-native"
import { Image } from "expo-image"
import { Ionicons } from "@expo/vector-icons"
import { FlatGrid } from "react-native-super-grid"
import { apiService } from "../services/api"
import { enhancedSyncService } from "../services/enhancedSyncService"
import { offlineService } from "../services/offlineService"
import type { Image as ImageType, SyncState } from "../types/api"

interface ImageGridProps {
  images: ImageType[]
  onImagePress: (image: ImageType, index: number) => void
  onImageLongPress?: (image: ImageType) => void
  isSelectionMode?: boolean
  selectedImages?: Set<number>
  onImageSelect?: (imageId: number) => void
  showSyncIndicators?: boolean
}

const { width } = Dimensions.get("window")
const itemSize = (width - 32) / 3 // 3 columns with padding

export const ImageGrid: React.FC<ImageGridProps> = ({
  images,
  onImagePress,
  onImageLongPress,
  isSelectionMode = false,
  selectedImages = new Set(),
  onImageSelect,
  showSyncIndicators = true,
}) => {
  const [syncStates, setSyncStates] = useState<Map<number, SyncState>>(new Map())

  useEffect(() => {
    if (showSyncIndicators) {
      loadSyncStates()
    }
  }, [images, showSyncIndicators])

  const loadSyncStates = async () => {
    const states = new Map<number, SyncState>()

    for (const image of images) {
      const state = await enhancedSyncService.getImageSyncState(image.id)
      states.set(image.id, state)
    }

    setSyncStates(states)
  }

  const getImageSource = async (image: ImageType) => {
    const localPath = await offlineService.getLocalImagePath(image.id)
    return localPath ? { uri: localPath } : { uri: apiService.getImageUrl(image.filename) }
  }

  const renderSyncIndicators = (image: ImageType) => {
    if (!showSyncIndicators) return null

    const syncState = syncStates.get(image.id)
    if (!syncState) return null

    return (
      <View style={styles.indicatorsContainer}>
        {syncState.isDownloaded && (
          <View style={[styles.indicator, styles.downloadedIndicator]}>
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
          </View>
        )}

        {syncState.isDownloading && (
          <View style={[styles.indicator, styles.downloadingIndicator]}>
            <ActivityIndicator size="small" color="#fff" />
          </View>
        )}

        {syncState.isUploading && (
          <View style={[styles.indicator, styles.uploadingIndicator]}>
            <Ionicons name="cloud-upload" size={16} color="#fff" />
          </View>
        )}

        {image.status === "pending" && (
          <View style={[styles.indicator, styles.pendingIndicator]}>
            <Ionicons name="time" size={16} color="#fff" />
          </View>
        )}
      </View>
    )
  }

  const renderImage = ({ item, index }: { item: ImageType; index: number }) => {
    const isSelected = selectedImages.has(item.id)

    return (
      <TouchableOpacity
        style={[styles.imageContainer, isSelected && styles.selectedImageContainer]}
        onPress={() => {
          if (isSelectionMode && onImageSelect) {
            onImageSelect(item.id)
          } else {
            onImagePress(item, index)
          }
        }}
        onLongPress={() => {
          if (onImageLongPress) {
            onImageLongPress(item)
          }
        }}
      >
        <Image
          source={{ uri: apiService.getImageUrl(item.filename) }}
          style={styles.image}
          contentFit="cover"
          transition={200}
          placeholder={{ blurhash: "L6PZfSi_.AyE_3t7t7R**0o#DgR4" }}
        />

        {renderSyncIndicators(item)}

        {isSelectionMode && (
          <View style={styles.selectionOverlay}>
            <View style={[styles.selectionCircle, isSelected && styles.selectedCircle]}>
              {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
            </View>
          </View>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <FlatGrid
      itemDimension={itemSize}
      data={images}
      style={styles.grid}
      spacing={4}
      renderItem={renderImage}
      staticDimension={width}
      fixed={true}
      maxItemsPerRow={3}
    />
  )
}

const styles = StyleSheet.create({
  grid: {
    flex: 1,
    backgroundColor: "#fff",
  },
  imageContainer: {
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
    aspectRatio: 1,
  },
  selectedImageContainer: {
    borderWidth: 3,
    borderColor: "#007AFF",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  indicatorsContainer: {
    position: "absolute",
    top: 4,
    right: 4,
    flexDirection: "row",
    gap: 4,
  },
  indicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  downloadedIndicator: {
    backgroundColor: "rgba(52, 199, 89, 0.9)",
  },
  downloadingIndicator: {
    backgroundColor: "rgba(0, 122, 255, 0.9)",
  },
  uploadingIndicator: {
    backgroundColor: "rgba(255, 149, 0, 0.9)",
  },
  pendingIndicator: {
    backgroundColor: "rgba(255, 204, 0, 0.9)",
  },
  selectionOverlay: {
    position: "absolute",
    top: 4,
    left: 4,
  },
  selectionCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#fff",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  selectedCircle: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
})
