"use client";

import type React from "react";
import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { syncService, SyncStatus } from "../services/syncService";

interface SyncScreenProps {
  navigation: any;
}

export const SyncScreen: React.FC<SyncScreenProps> = ({ navigation }) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    loadSyncStatus();
  }, []);

  const loadSyncStatus = async () => {
    try {
      const status = await syncService.getSyncStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error("Failed to load sync status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const performSync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncService.syncAll();
      Alert.alert(
        "Sync Complete",
        `Downloads: ${result.downloads.success} success, ${result.downloads.failed} failed\nUploads: ${result.uploads.success} success, ${result.uploads.failed} failed`,
      );
      loadSyncStatus();
    } catch (error) {
      Alert.alert("Sync Error", "Failed to sync data");
    } finally {
      setIsSyncing(false);
    }
  };

  const clearSyncData = () => {
    Alert.alert(
      "Clear Sync Data",
      "This will remove all pending uploads and downloads. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await syncService.clearAllSyncData();
            loadSyncStatus();
            Alert.alert("Success", "Sync data cleared");
          },
        },
      ],
    );
  };

  const formatLastSync = (timestamp: number) => {
    if (timestamp === 0) return "Never";
    return new Date(timestamp).toLocaleString();
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Status Card */}
      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <Ionicons name="sync" size={24} color="#007AFF" />
          <Text style={styles.statusTitle}>Sync Status</Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Connection:</Text>
          <View style={styles.statusIndicator}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: syncStatus?.isOnline ? "#34C759" : "#FF3B30",
                },
              ]}
            />
            <Text style={styles.statusValue}>
              {syncStatus?.isOnline ? "Online" : "Offline"}
            </Text>
          </View>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Last Sync:</Text>
          <Text style={styles.statusValue}>
            {formatLastSync(syncStatus?.lastSync || 0)}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Pending Uploads:</Text>
          <Text style={[styles.statusValue, styles.pendingCount]}>
            {syncStatus?.pendingUploads || 0}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Pending Downloads:</Text>
          <Text style={[styles.statusValue, styles.pendingCount]}>
            {syncStatus?.pendingDownloads || 0}
          </Text>
        </View>
      </View>

      {/* Storage Card */}
      <View style={styles.storageCard}>
        <View style={styles.storageHeader}>
          <Ionicons name="phone-portrait" size={24} color="#34C759" />
          <Text style={styles.storageTitle}>Offline Storage</Text>
        </View>

        <View style={styles.storageStats}>
          <View style={styles.storageStat}>
            <Text style={styles.storageNumber}>
              {syncStatus?.offlineImagesCount || 0}
            </Text>
            <Text style={styles.storageLabel}>Images</Text>
          </View>
          <View style={styles.storageStat}>
            <Text style={styles.storageNumber}>
              {syncService.formatStorageSize(syncStatus.totalOfflineSize || 0)}
            </Text>
            <Text style={styles.storageLabel}>Storage Used</Text>
          </View>
        </View>
      </View>

      {/* Actions Card */}
      <View style={styles.actionsCard}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.syncButton,
            isSyncing && styles.actionButtonDisabled,
          ]}
          onPress={performSync}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="sync" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Sync Now</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.refreshButton]}
          onPress={loadSyncStatus}
        >
          <Ionicons name="refresh" size={20} color="#007AFF" />
          <Text style={[styles.actionButtonText, { color: "#007AFF" }]}>
            Refresh Status
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.clearButton]}
          onPress={clearSyncData}
        >
          <Ionicons name="trash" size={20} color="#FF3B30" />
          <Text style={[styles.actionButtonText, { color: "#FF3B30" }]}>
            Clear Sync Data
          </Text>
        </TouchableOpacity>
      </View>

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>How Sync Works</Text>
        <Text style={styles.infoText}>
          • Images are downloaded to your device and saved to your gallery{"\n"}
          • Downloaded images are available offline in their respective albums
          {"\n"}• Visual indicators show download status, pending approval, and
          sync progress{"\n"}• Use "Sync Album" to download all images from an
          album at once
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  statusCard: {
    backgroundColor: "#fff",
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginLeft: 12,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 16,
    color: "#666",
  },
  statusValue: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  statusIndicator: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  pendingCount: {
    color: "#FF9500",
    fontWeight: "600",
  },
  storageCard: {
    backgroundColor: "#fff",
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  storageHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  storageTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginLeft: 12,
  },
  storageStats: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  storageStat: {
    alignItems: "center",
  },
  storageNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: "#34C759",
  },
  storageLabel: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  actionsCard: {
    backgroundColor: "#fff",
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  syncButton: {
    backgroundColor: "#007AFF",
  },
  refreshButton: {
    backgroundColor: "#f0f0f0",
  },
  clearButton: {
    backgroundColor: "#f0f0f0",
    marginBottom: 0,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginLeft: 8,
  },
  infoCard: {
    backgroundColor: "#fff",
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
});
