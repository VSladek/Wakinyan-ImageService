import React from "react"
import { useState, useEffect, useRef } from "react"
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  TextInput,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  StatusBar,
  Modal,
  PanResponder,
  Platform,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import * as FileSystem from "expo-file-system"
import * as MediaLibrary from "expo-media-library"
import * as NavigationBar from "expo-navigation-bar"
import { apiService } from "../services/api"
import type { Image as ImageType, Comment } from "../types/api"
import { useAuth } from "../contexts/AuthContext"
import { useFocusEffect } from "@react-navigation/native"

// Add these imports at the top
import { PinchGestureHandler } from "react-native-gesture-handler"
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedGestureHandler,
  withSpring,
} from "react-native-reanimated"

interface ImageDetailScreenProps {
  navigation: any
  route: {
    params: {
      images: ImageType[]
      initialIndex: number
      onImageUpdate?: () => void
      albumName?: string
    }
  }
}

const { width, height } = Dimensions.get("window")

export const ImageDetailScreen: React.FC<ImageDetailScreenProps> = ({ navigation, route }) => {
  const { images, initialIndex, onImageUpdate, albumName } = route.params
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [isLoadingComments, setIsLoadingComments] = useState(true)
  const [isAddingComment, setIsAddingComment] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const { user } = useAuth()

  const currentImage = images[currentIndex]
  const scrollViewRef = useRef<ScrollView>(null)

  // Add zoom functionality
  const scale = useSharedValue(1)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)

  const pinchHandler = useAnimatedGestureHandler({
    onStart: (_, context) => {
      context.startScale = scale.value
    },
    onActive: (event, context) => {
      scale.value = context.startScale * event.scale
    },
    onEnd: () => {
      if (scale.value < 1) {
        scale.value = withSpring(1)
        translateX.value = withSpring(0)
        translateY.value = withSpring(0)
      } else if (scale.value > 3) {
        scale.value = withSpring(3)
      }
    },
  })

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }, { translateX: translateX.value }, { translateY: translateY.value }],
    }
  })

  // Pan responder for swipe navigation
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx > 50 && currentIndex > 0) {
        // Swipe right - previous image
        navigateToImage(currentIndex - 1)
      } else if (gestureState.dx < -50 && currentIndex < images.length - 1) {
        // Swipe left - next image
        navigateToImage(currentIndex + 1)
      }
    },
  })

  const navigateToImage = (index: number) => {
    setCurrentIndex(index)
    // Reset zoom when changing images
    scale.value = withSpring(1)
    translateX.value = withSpring(0)
    translateY.value = withSpring(0)
  }

  // Hide system UI when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      const hideSystemUI = async () => {
        // Hide status bar
        StatusBar.setHidden(true, "fade")

        // Hide navigation bar on Android
        if (Platform.OS === "android") {
          try {
            await NavigationBar.setVisibilityAsync("hidden")
            await NavigationBar.setBehaviorAsync("overlay-swipe")
          } catch (error) {
            console.log("Navigation bar control not available")
          }
        }
      }

      const showSystemUI = async () => {
        // Show status bar
        StatusBar.setHidden(false, "fade")

        // Show navigation bar on Android
        if (Platform.OS === "android") {
          try {
            await NavigationBar.setVisibilityAsync("visible")
          } catch (error) {
            console.log("Navigation bar control not available")
          }
        }
      }

      hideSystemUI()

      // Cleanup function to restore system UI when leaving screen
      return () => {
        showSystemUI()
      }
    }, []),
  )

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    })
    loadComments()

    const timer = setTimeout(() => {
      setShowControls(false)
    }, 3000)

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    loadComments()
  }, [currentIndex])

  const loadComments = async () => {
    if (!currentImage) return

    setIsLoadingComments(true)
    try {
      const response = await apiService.getImageComments(currentImage.id)
      setComments(response.comments || [])
    } catch (error) {
      console.error("Failed to load comments:", error)
    } finally {
      setIsLoadingComments(false)
    }
  }

  const addComment = async () => {
    if (!newComment.trim()) return

    setIsAddingComment(true)
    try {
      await apiService.addComment(currentImage.id, newComment.trim())
      setNewComment("")
      loadComments()
    } catch (error) {
      Alert.alert("Failed to add comment")
    } finally {
      setIsAddingComment(false)
    }
  }

  const downloadImage = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync()
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please grant gallery access")
        return
      }

      setIsDownloading(true)
      const imageUrl = apiService.getImageUrl(currentImage.filename)
      const fileUri = FileSystem.documentDirectory + currentImage.filename

      const downloadResult = await FileSystem.downloadAsync(imageUrl, fileUri)

      if (downloadResult.status === 200) {
        const asset = await MediaLibrary.createAssetAsync(downloadResult.uri)

        try {
          // Get the album name from navigation params or API
          const albumName = route.params.albumName || "Image Service"
          const albums = await MediaLibrary.getAlbumsAsync()
          const existingAlbum = albums.find((album) => album.title === albumName)

          if (existingAlbum) {
            await MediaLibrary.addAssetsToAlbumAsync([asset], existingAlbum, false)
          } else {
            await MediaLibrary.createAlbumAsync(albumName, asset, false)
          }
        } catch (albumError) {
          console.log("Album creation failed, saved to camera roll")
        }

        Alert.alert("Downloaded", `Saved to ${albumName || "Image Service"} album`)
      } else {
        throw new Error("Download failed")
      }
    } catch (error) {
      Alert.alert("Download failed")
    } finally {
      setIsDownloading(false)
    }
  }

  const approveImage = async () => {
    try {
      await apiService.approveImage(currentImage.id)
      Alert.alert("Approved", "Image has been approved")
      onImageUpdate?.() // Refresh the gallery
    } catch (error) {
      Alert.alert("Failed to approve image")
    }
  }

  const rejectImage = async () => {
    Alert.alert("Reject Image", "This will permanently delete the image. Continue?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: async () => {
          try {
            await apiService.rejectImage(currentImage.id)
            Alert.alert("Rejected", "Image has been deleted")
            onImageUpdate?.() // Refresh the gallery
            navigation.goBack() // Go back since image is deleted
          } catch (error) {
            Alert.alert("Failed to reject image")
          }
        },
      },
    ])
  }

  const toggleControls = () => {
    setShowControls(!showControls)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (!currentImage) {
    return (
      <View style={styles.container}>
        <Text>Image not found</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Full-screen image with swipe navigation */}
      <View style={styles.imageContainer} {...panResponder.panHandlers}>
        <TouchableOpacity style={styles.imageTouch} onPress={toggleControls} activeOpacity={1}>
          <PinchGestureHandler onGestureEvent={pinchHandler}>
            <Animated.View style={[{ flex: 1 }, animatedStyle]}>
              <Image
                source={{ uri: apiService.getImageUrl(currentImage.filename) }}
                style={styles.image}
                resizeMode="contain"
              />
            </Animated.View>
          </PinchGestureHandler>
        </TouchableOpacity>
      </View>

      {/* Controls overlay */}
      {showControls && (
        <View style={styles.controlsOverlay}>
          {/* Top controls */}
          <View style={styles.topControls}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>

            <View style={styles.topRightControls}>
              <Text style={styles.imageCounter}>
                {currentIndex + 1} of {images.length}
              </Text>
              {currentImage.status === "pending" && (
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingText}>Pending</Text>
                </View>
              )}
            </View>
          </View>

          {/* Bottom controls */}
          <View style={styles.bottomControls}>
            <TouchableOpacity style={styles.controlButton} onPress={() => setShowComments(true)}>
              <Ionicons name="chatbubble" size={20} color="#fff" />
              <Text style={styles.controlButtonText}>{comments.length}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, isDownloading && styles.controlButtonDisabled]}
              onPress={downloadImage}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="download" size={20} color="#fff" />
              )}
            </TouchableOpacity>

            {/* Admin approval controls */}
            {user?.role === "admin" && currentImage.status === "pending" && (
              <>
                <TouchableOpacity style={styles.approveButton} onPress={approveImage}>
                  <Ionicons name="checkmark" size={20} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.rejectButton} onPress={rejectImage}>
                  <Ionicons name="close" size={20} color="#fff" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}

      {/* Navigation indicators */}
      {images.length > 1 && showControls && (
        <View style={styles.navigationIndicators}>
          {currentIndex > 0 && (
            <TouchableOpacity
              style={[styles.navButton, styles.prevButton]}
              onPress={() => navigateToImage(currentIndex - 1)}
            >
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
          )}

          {currentIndex < images.length - 1 && (
            <TouchableOpacity
              style={[styles.navButton, styles.nextButton]}
              onPress={() => navigateToImage(currentIndex + 1)}
            >
              <Ionicons name="chevron-forward" size={24} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Comments Modal */}
      <Modal visible={showComments} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.commentsModal}>
          <View style={styles.commentsHeader}>
            <Text style={styles.commentsTitle}>Comments</Text>
            <TouchableOpacity onPress={() => setShowComments(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.commentsList} showsVerticalScrollIndicator={false}>
            {isLoadingComments ? (
              <ActivityIndicator style={styles.loadingComments} />
            ) : comments.length === 0 ? (
              <Text style={styles.noComments}>No comments yet</Text>
            ) : (
              comments.map((comment) => (
                <View key={comment.id} style={styles.commentCard}>
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentAuthor}>{comment.author}</Text>
                    <Text style={styles.commentDate}>{formatDate(comment.created_at)}</Text>
                  </View>
                  <Text style={styles.commentContent}>{comment.content}</Text>
                </View>
              ))
            )}
          </ScrollView>

          <View style={styles.addCommentSection}>
            <TextInput
              style={styles.commentInput}
              placeholder="Add a comment..."
              value={newComment}
              onChangeText={setNewComment}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!newComment.trim() || isAddingComment) && styles.sendButtonDisabled]}
              onPress={addComment}
              disabled={!newComment.trim() || isAddingComment}
            >
              {isAddingComment ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  imageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  imageTouch: {
    flex: 1,
    width: "100%",
  },
  image: {
    width: width,
    height: height,
  },
  controlsOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "space-between",
  },
  topControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 60 : 40, // Adjusted for system UI
    paddingHorizontal: 20,
  },
  topRightControls: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  imageCounter: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    marginRight: 12,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pendingBadge: {
    backgroundColor: "rgba(255, 165, 0, 0.9)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  pendingText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  bottomControls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: Platform.OS === "ios" ? 60 : 40, // Adjusted for system UI
    gap: 20,
  },
  controlButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    minWidth: 60,
    justifyContent: "center",
  },
  controlButtonDisabled: {
    opacity: 0.6,
  },
  controlButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 6,
  },
  approveButton: {
    backgroundColor: "rgba(52, 199, 89, 0.9)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    minWidth: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  rejectButton: {
    backgroundColor: "rgba(255, 59, 48, 0.9)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    minWidth: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  navigationIndicators: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  navButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  prevButton: {
    alignSelf: "flex-start",
  },
  nextButton: {
    alignSelf: "flex-end",
  },
  commentsModal: {
    flex: 1,
    backgroundColor: "#fff",
  },
  commentsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: Platform.OS === "ios" ? 60 : 20, // Handle safe area
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  commentsList: {
    flex: 1,
    padding: 20,
  },
  loadingComments: {
    padding: 20,
  },
  noComments: {
    textAlign: "center",
    color: "#666",
    fontStyle: "italic",
    padding: 40,
  },
  commentCard: {
    backgroundColor: "#f8f9fa",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  commentDate: {
    fontSize: 12,
    color: "#666",
  },
  commentContent: {
    fontSize: 14,
    color: "#333",
    lineHeight: 18,
  },
  addCommentSection: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 20, // Handle safe area
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 80,
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: "#007AFF",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
})
