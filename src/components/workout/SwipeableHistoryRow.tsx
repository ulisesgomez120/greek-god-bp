import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import Icon from "../../components/ui/Icon";
import useTheme from "@/hooks/useTheme";

const MAX_ACTION_WIDTH = 140; // total width for both buttons
const BUTTON_WIDTH = 70;
const SWIPE_THRESHOLD = 60;

type Props = {
  children: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
};

const SwipeableHistoryRow: React.FC<Props> = ({ children, onEdit, onDelete }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);

  const pan = Gesture.Pan()
    .onStart(() => {
      // store the start position in a shared value (avoid ctx typing issues)
      startX.value = translateX.value;
    })
    .onUpdate((e: any) => {
      const next = startX.value + e.translationX;
      // only allow left swipe (negative translate)
      translateX.value = Math.max(Math.min(next, 0), -MAX_ACTION_WIDTH);
    })
    .onEnd(() => {
      if (translateX.value < -SWIPE_THRESHOLD) {
        translateX.value = withSpring(-MAX_ACTION_WIDTH, { damping: 20, stiffness: 90 });
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 90 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={styles.wrapper}>
      <View style={styles.actionButtonsContainer} pointerEvents='box-none'>
        <View style={{ flexDirection: "row" }}>
          <TouchableOpacity
            onPress={() => {
              onEdit?.();
              translateX.value = withSpring(0, { damping: 20, stiffness: 90 });
            }}
            style={[styles.button, { backgroundColor: colors.primary }]}
            accessibilityLabel='Edit set'>
            <Icon name='create-outline' size={22} color='#fff' />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              onDelete?.();
              translateX.value = withSpring(0, { damping: 20, stiffness: 90 });
            }}
            style={[styles.button, { backgroundColor: "#d9534f" }]}
            accessibilityLabel='Delete set'>
            <Icon name='trash-outline' size={22} color='#fff' />
          </TouchableOpacity>
        </View>
      </View>

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.animatedContent, animatedStyle]}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    wrapper: {
      width: "100%",
      position: "relative",
      overflow: "hidden",
    },
    actionButtonsContainer: {
      position: "absolute",
      right: 0,
      top: 0,
      bottom: 0,
      width: MAX_ACTION_WIDTH,
      justifyContent: "center",
      alignItems: "flex-end",
    },
    button: {
      width: BUTTON_WIDTH,
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
    },
    animatedContent: {
      backgroundColor: colors.background,
    },
  });

export default SwipeableHistoryRow;
