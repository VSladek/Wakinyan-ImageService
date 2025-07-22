"use client"

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
import { apiService } from "../services/api"
import type { Image as ImageType } from "../types/api"

interface PendingImagesScreenProps {
  navigation: any
}

const { width } = Dimensions.get("window")
const imageSize = (width - 48) / 2

export const PendingImagesScreen: React.FC<PendingImagesScreenProps> = ({ navigation }) => {
  const [images, setImages] = useState<ImageType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    loadPendingImages()
  }, [])

  const loadPendingImages = async () => {
    try {
      const response = await apiService.getPendingImages()
      setImages(response.images || [])
    } catch (error) {
      Alert.alert("Error", "Failed to load pending images")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    loadPendingImages()
  }

  const approveImage = async (imageId: number) => {
    try {
      await apiService.approveImage(imageId)
      Alert.alert("Success", "Image approved successfully")
      loadPendingImages()
    } catch (error) {
      Alert.alert("Error", "Failed to approve image")
    }
  }

  const rejectImage = async (imageId: number) => {
    Alert.alert("Reject Image", "Are you sure you want to reject this image? This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: async () => {
          try {
            await apiService.rejectImage(imageId)
            Alert.alert("Success", "Image rejected and deleted")
            loadPendingImages()
          } catch (error) {
            Alert.alert("Error", "Failed to reject image")
          }
        },
      },
    ])
  }

  const renderImage = ({ item }: { item: ImageType }) => (
    <View style={styles.imageCard}>
      <TouchableOpacity
        style={styles.imageContainer}
        onPress={() => navigation.navigate("ImageDetail", { image: item })}
      >
        <Image source={{ uri: apiService.getImageUrl(item.filename) }} style={styles.image} resizeMode="cover" />
      </TouchableOpacity>

      <View style={styles.actionButtons}>
        <TouchableOpacity style={[styles.actionButton, styles.approveButton]} onPress={() => approveImage(item.id)}>
          <Ionicons name="checkmark" size={20} color="#fff" />
          <Text style={styles.buttonText}>Approve</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, styles.rejectButton]} onPress={() => rejectImage(item.id)}>
          <Ionicons name="close" size={20} color="#fff" />
          <Text style={styles.buttonText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  return (
    <View style={styles.container}>
      <FlatList
        data={images}
        renderItem={renderImage}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No pending images</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  listContainer: {
    padding: 16,
  },
  imageCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    width: "100%",
    height: 200,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  actionButtons: {
    flexDirection: "row",
    padding: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  approveButton: {
    backgroundColor: "#34C759",
  },
  rejectButton: {
    backgroundColor: "#FF3B30",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "500",
    marginLeft: 4,
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
})
