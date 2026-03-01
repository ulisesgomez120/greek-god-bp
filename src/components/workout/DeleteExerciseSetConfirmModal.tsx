import React, { useCallback, useMemo, useState } from "react";
import { Modal, View, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import Text from "@/components/ui/Text";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";
import useTheme from "@/hooks/useTheme";

type Props = {
  visible: boolean;
  title?: string;
  message?: string;
  onClose: () => void;
  onConfirmDelete: () => Promise<{ success: boolean; error?: string }>;
};

export default function DeleteExerciseSetConfirmModal({ visible, title, message, onClose, onConfirmDelete }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(false);

  const handleDelete = useCallback(async () => {
    try {
      setLoading(true);
      const res = await onConfirmDelete();
      setLoading(false);
      if (res?.success) {
        onClose();
      } else {
        Alert.alert("Unable to delete", res?.error || "An unknown error occurred");
      }
    } catch (e: any) {
      setLoading(false);
      Alert.alert("Error", e?.message || "Failed to delete set");
    }
  }, [onClose, onConfirmDelete]);

  return (
    <Modal visible={visible} animationType='fade' onRequestClose={onClose} transparent>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.card}>
          <View style={styles.header}>
            <Text variant='h3' color='primary' style={styles.title}>
              {title ?? "Delete Set?"}
            </Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel='Close delete confirmation' style={styles.closeBtn}>
              <Icon name='close' size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {message ? (
            <Text variant='body' color='secondary' style={styles.message}>
              {message}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Button variant='secondary' onPress={onClose} style={styles.actionBtn} disabled={loading}>
              Cancel
            </Button>
            <Button variant='danger' onPress={handleDelete} loading={loading} style={styles.actionBtn}>
              {loading ? <ActivityIndicator color={colors.surface || "#FFFFFF"} /> : "Delete"}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "center",
      padding: 20,
    },
    backdrop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.55)",
    },
    card: {
      backgroundColor: colors.background,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    title: {
      flex: 1,
      marginRight: 8,
    },
    closeBtn: {
      width: 36,
      height: 36,
      justifyContent: "center",
      alignItems: "center",
    },
    message: {
      marginTop: 4,
      marginBottom: 16,
      color: colors.subtext,
      lineHeight: 20,
    },
    actions: {
      flexDirection: "row",
      gap: 12,
    },
    actionBtn: {
      flex: 1,
      height: 50,
    },
  });
