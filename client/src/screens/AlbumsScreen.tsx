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
  TextInput,
  Modal,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { apiService } from "../services/api"
import type { Album } from "../types/api"
import { useAuth } from "../contexts/AuthContext"

interface AlbumsScreenProps {
  navigation: any
}

export const AlbumsScreen: React.FC<AlbumsScreenProps> = ({ navigation }) => {
  const [albums, setAlbums] = useState<Album[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newAlbumName, setNewAlbumName] = useState("")
  const { user } = useAuth()

  useEffect(() => {
    loadAlbums()
  }, [])

  const loadAlbums = async () => {
    try {
      const response = await apiService.getAlbums()
      setAlbums(response.albums || [])
    } catch (error) {
      Alert.alert("Error", "Failed to load albums")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    loadAlbums()
  }

  const createAlbum = async () => {
    if (!newAlbumName.trim()) {
      Alert.alert("Error", "Please enter an album name")
      return
    }

    try {
      await apiService.createAlbum(newAlbumName.trim())
      setNewAlbumName("")
      setShowCreateModal(false)
      loadAlbums()
    } catch (error) {
      Alert.alert("Error", "Failed to create album")
    }
  }

  const renderAlbum = ({ item }: { item: Album }) => (
    <TouchableOpacity style={styles.albumCard} onPress={() => navigation.navigate("AlbumImages", { album: item })}>
      <View style={styles.albumIcon}>
        <Ionicons name="folder" size={32} color="#007AFF" />
      </View>
      <Text style={styles.albumName}>{item.name}</Text>
      <Ionicons name="chevron-forward" size={20} color="#ccc" />
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      <FlatList
        data={albums}
        renderItem={renderAlbum}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No albums found</Text>
          </View>
        }
      />

      {user?.role === "admin" && (
        <TouchableOpacity style={styles.fab} onPress={() => setShowCreateModal(true)}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      )}

      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Album</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Album name"
              value={newAlbumName}
              onChangeText={setNewAlbumName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.createButton]} onPress={createAlbum}>
                <Text style={styles.createButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  albumCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  albumIcon: {
    marginRight: 16,
  },
  albumName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    width: "80%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
    textAlign: "center",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 4,
  },
  cancelButton: {
    backgroundColor: "#f0f0f0",
  },
  createButton: {
    backgroundColor: "#007AFF",
  },
  cancelButtonText: {
    color: "#666",
    fontWeight: "500",
  },
  createButtonText: {
    color: "#fff",
    fontWeight: "500",
  },
})
