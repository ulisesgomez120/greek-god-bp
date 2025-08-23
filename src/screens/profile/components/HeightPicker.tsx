import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet, GestureResponderEvent } from "react-native";
import { formatCmToFtIn } from "@/utils/unitConversions";

interface Props {
  valueCm?: number | null;
  onChange: (valueCm?: number) => void;
  unitIsMetric: boolean;
  style?: any;
  testID?: string;
}

/**
 * HeightPicker
 *
 * - Shows current height (cm or ft/in)
 * - Opens a modal with a list of common heights (100cm - 220cm)
 * - Includes a "Custom" option which emits undefined so the parent can show a numeric input
 *
 * This component purposely keeps logic simple and self-contained so it can be used
 * in ProfileEditScreen without introducing new external dependencies.
 */
export default function HeightPicker({ valueCm, onChange, unitIsMetric, style, testID }: Props) {
  const [open, setOpen] = useState(false);

  const heights = useMemo(() => {
    const min = 100;
    const max = 220;
    const arr: number[] = [];
    for (let cm = min; cm <= max; cm++) {
      arr.push(cm);
    }
    return arr;
  }, []);

  const displayFor = (cm?: number | null) => {
    if (cm == null) return "Custom";
    return unitIsMetric ? `${cm} cm` : formatCmToFtIn(cm);
  };

  const handleSelect = (cm?: number) => (e?: GestureResponderEvent) => {
    setOpen(false);
    onChange(cm);
  };

  const renderItem = ({ item }: { item: number }) => (
    <TouchableOpacity style={styles.option} onPress={handleSelect(item)} testID={`height-option-${item}`}>
      <Text style={styles.optionText}>{displayFor(item)}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity onPress={() => setOpen(true)} style={styles.control} testID={testID ?? "height-picker-control"}>
        <Text style={styles.controlText}>{displayFor(valueCm)}</Text>
      </TouchableOpacity>

      <Modal visible={open} animationType='slide' onRequestClose={() => setOpen(false)}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Select height</Text>
          <FlatList
            data={heights}
            keyExtractor={(i) => String(i)}
            renderItem={renderItem}
            initialNumToRender={20}
            contentContainerStyle={styles.list}
            testID='height-picker-list'
          />
          <TouchableOpacity style={styles.option} onPress={handleSelect(undefined)} testID='height-option-custom'>
            <Text style={[styles.optionText, styles.customText]}>Custom</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeButton} onPress={() => setOpen(false)} testID='height-picker-close'>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 120,
  },
  control: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#FFF",
  },
  controlText: {
    fontSize: 16,
    color: "#111",
  },
  modal: {
    flex: 1,
    paddingTop: 48,
    paddingHorizontal: 16,
    backgroundColor: "#FFF",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  list: {
    paddingBottom: 24,
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F1F1",
  },
  optionText: {
    fontSize: 16,
    color: "#111",
  },
  customText: {
    fontStyle: "italic",
    color: "#555",
  },
  closeButton: {
    marginTop: 18,
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: "#F2F2F2",
  },
  closeButtonText: {
    fontSize: 16,
    color: "#333",
  },
});
