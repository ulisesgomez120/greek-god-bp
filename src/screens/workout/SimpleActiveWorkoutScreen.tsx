// ============================================================================
// SIMPLE ACTIVE WORKOUT SCREEN
// ============================================================================
// Simplified workout screen that works with the new navigation flow

import React, { useState, useEffect } from "react";
import { View, ScrollView, StyleSheet, SafeAreaView, Alert } from "react-native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";

// Components
import Text from "../../components/ui/Text";
import { Button } from "../../components/ui/Button";

// Utils
import { formatProgramPhase } from "../../utils/formatters";

// Types
import { WorkoutStackParamList } from "../../types/navigation";

// ============================================================================
// TYPES
// ============================================================================

type SimpleActiveWorkoutScreenNavigationProp = StackNavigationProp<WorkoutStackParamList, "ActiveWorkout">;
type SimpleActiveWorkoutScreenRouteProp = RouteProp<WorkoutStackParamList, "ActiveWorkout">;

interface SimpleActiveWorkoutScreenProps {
  navigation: SimpleActiveWorkoutScreenNavigationProp;
  route: SimpleActiveWorkoutScreenRouteProp;
}

interface ExerciseSet {
  id: string;
  weight: number;
  reps: number;
  rpe?: number;
  completed: boolean;
}

interface WorkoutExercise {
  id: string;
  name: string;
  targetSets: number;
  targetReps: string;
  targetRpe: string;
  sets: ExerciseSet[];
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const SimpleActiveWorkoutScreen: React.FC<SimpleActiveWorkoutScreenProps> = ({ navigation, route }) => {
  const { workoutId, programId, phaseId, dayId, workoutName } = route.params || {};

  // State
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [workoutStartTime] = useState(Date.now());
  const [workoutDuration, setWorkoutDuration] = useState(0);

  // Mock exercises data - in real app this would come from the database
  const [exercises, setExercises] = useState<WorkoutExercise[]>([
    {
      id: "1",
      name: "Back Squat",
      targetSets: 3,
      targetReps: "6-8",
      targetRpe: "7-8",
      sets: [
        { id: "1-1", weight: 0, reps: 0, rpe: undefined, completed: false },
        { id: "1-2", weight: 0, reps: 0, rpe: undefined, completed: false },
        { id: "1-3", weight: 0, reps: 0, rpe: undefined, completed: false },
      ],
    },
    {
      id: "2",
      name: "Barbell Bench Press",
      targetSets: 3,
      targetReps: "8-10",
      targetRpe: "7-8",
      sets: [
        { id: "2-1", weight: 0, reps: 0, rpe: undefined, completed: false },
        { id: "2-2", weight: 0, reps: 0, rpe: undefined, completed: false },
        { id: "2-3", weight: 0, reps: 0, rpe: undefined, completed: false },
      ],
    },
    {
      id: "3",
      name: "Lat Pulldown",
      targetSets: 3,
      targetReps: "10-12",
      targetRpe: "8",
      sets: [
        { id: "3-1", weight: 0, reps: 0, rpe: undefined, completed: false },
        { id: "3-2", weight: 0, reps: 0, rpe: undefined, completed: false },
        { id: "3-3", weight: 0, reps: 0, rpe: undefined, completed: false },
      ],
    },
  ]);

  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setWorkoutDuration(Math.floor((Date.now() - workoutStartTime) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [workoutStartTime]);

  // Handlers
  const handleSetComplete = (exerciseIndex: number, setIndex: number, weight: number, reps: number, rpe?: number) => {
    setExercises((prev) => {
      const updated = [...prev];
      updated[exerciseIndex].sets[setIndex] = {
        ...updated[exerciseIndex].sets[setIndex],
        weight,
        reps,
        rpe,
        completed: true,
      };
      return updated;
    });
  };

  const handleNextExercise = () => {
    if (currentExerciseIndex < exercises.length - 1) {
      setCurrentExerciseIndex(currentExerciseIndex + 1);
    }
  };

  const handlePreviousExercise = () => {
    if (currentExerciseIndex > 0) {
      setCurrentExerciseIndex(currentExerciseIndex - 1);
    }
  };

  const handleCompleteWorkout = () => {
    const completedSets = exercises.reduce((total, ex) => total + ex.sets.filter((s) => s.completed).length, 0);
    const totalSets = exercises.reduce((total, ex) => total + ex.sets.length, 0);

    Alert.alert(
      "Complete Workout",
      `You've completed ${completedSets} of ${totalSets} sets. Are you sure you want to finish?`,
      [
        { text: "Continue", style: "cancel" },
        {
          text: "Complete",
          onPress: () => {
            Alert.alert("Workout Complete!", "Great job! Your workout has been saved.", [
              { text: "OK", onPress: () => navigation.navigate("WorkoutHome") },
            ]);
          },
        },
      ]
    );
  };

  const handleExitWorkout = () => {
    Alert.alert("Exit Workout", "Are you sure you want to exit? Your progress will be lost.", [
      { text: "Continue", style: "cancel" },
      { text: "Exit", style: "destructive", onPress: () => navigation.goBack() },
    ]);
  };

  const currentExercise = exercises[currentExerciseIndex];
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!currentExercise) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text variant='h2' color='primary' style={styles.errorTitle}>
            No Workout Found
          </Text>
          <Text variant='body' color='secondary' style={styles.errorText}>
            We couldn't load your workout. Please try selecting a workout again.
          </Text>
          <Button onPress={() => navigation.goBack()} style={styles.errorButton}>
            <Text variant='button' style={styles.errorButtonText}>
              Go Back
            </Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Button variant='text' onPress={handleExitWorkout}>
            <Text style={styles.exitText}>Exit</Text>
          </Button>

          <View style={styles.timerContainer}>
            <Text style={styles.timerText}>{formatTime(workoutDuration)}</Text>
            <Text style={styles.workoutTitle}>{workoutName || "Workout"}</Text>
          </View>

          <Button variant='text' onPress={handleCompleteWorkout}>
            <Text style={styles.finishText}>Finish</Text>
          </Button>
        </View>

        {programId && phaseId && (
          <Text variant='bodySmall' color='secondary' style={styles.subtitle}>
            {formatProgramPhase(programId, phaseId)}
          </Text>
        )}

        {/* Progress */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${((currentExerciseIndex + 1) / exercises.length) * 100}%` }]}
            />
          </View>
          <Text style={styles.progressText}>
            Exercise {currentExerciseIndex + 1} of {exercises.length}
          </Text>
        </View>
      </View>

      {/* Exercise Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.exerciseHeader}>
          <Text variant='h2' color='primary' style={styles.exerciseName}>
            {currentExercise.name}
          </Text>
          <Text variant='body' color='secondary'>
            {currentExercise.targetSets} sets • {currentExercise.targetReps} reps • RPE {currentExercise.targetRpe}
          </Text>
        </View>

        {/* Sets */}
        <View style={styles.setsContainer}>
          {currentExercise.sets.map((set, setIndex) => (
            <SetCard
              key={set.id}
              set={set}
              setNumber={setIndex + 1}
              onComplete={(weight, reps, rpe) => handleSetComplete(currentExerciseIndex, setIndex, weight, reps, rpe)}
            />
          ))}
        </View>
      </ScrollView>

      {/* Navigation */}
      <View style={styles.navigation}>
        <Button
          variant='secondary'
          onPress={handlePreviousExercise}
          disabled={currentExerciseIndex === 0}
          style={styles.navButton}>
          <Text style={styles.navButtonText}>← Previous</Text>
        </Button>

        <Button
          variant='secondary'
          onPress={handleNextExercise}
          disabled={currentExerciseIndex === exercises.length - 1}
          style={styles.navButton}>
          <Text style={styles.navButtonText}>Next →</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
};

// ============================================================================
// SET CARD COMPONENT
// ============================================================================

interface SetCardProps {
  set: ExerciseSet;
  setNumber: number;
  onComplete: (weight: number, reps: number, rpe?: number) => void;
}

const SetCard: React.FC<SetCardProps> = ({ set, setNumber, onComplete }) => {
  const [weight, setWeight] = useState(set.weight.toString());
  const [reps, setReps] = useState(set.reps.toString());
  const [rpe, setRpe] = useState(set.rpe?.toString() || "");

  const handleComplete = () => {
    const weightNum = parseFloat(weight) || 0;
    const repsNum = parseInt(reps) || 0;
    const rpeNum = rpe ? parseInt(rpe) : undefined;

    if (repsNum > 0) {
      onComplete(weightNum, repsNum, rpeNum);
    }
  };

  return (
    <View style={[styles.setCard, set.completed && styles.setCardCompleted]}>
      <View style={styles.setHeader}>
        <Text variant='h3' color='primary'>
          Set {setNumber}
        </Text>
        {set.completed && <Text style={styles.completedBadge}>✓</Text>}
      </View>

      {!set.completed ? (
        <View style={styles.setInputs}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Weight (kg)</Text>
            <View style={styles.inputContainer}>
              <Button onPress={() => setWeight((prev) => Math.max(0, parseFloat(prev || "0") - 2.5).toString())}>
                <Text>-</Text>
              </Button>
              <Text style={styles.inputValue}>{weight || "0"}</Text>
              <Button onPress={() => setWeight((prev) => (parseFloat(prev || "0") + 2.5).toString())}>
                <Text>+</Text>
              </Button>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Reps</Text>
            <View style={styles.inputContainer}>
              <Button onPress={() => setReps((prev) => Math.max(0, parseInt(prev || "0") - 1).toString())}>
                <Text>-</Text>
              </Button>
              <Text style={styles.inputValue}>{reps || "0"}</Text>
              <Button onPress={() => setReps((prev) => (parseInt(prev || "0") + 1).toString())}>
                <Text>+</Text>
              </Button>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>RPE (1-10)</Text>
            <View style={styles.inputContainer}>
              <Button onPress={() => setRpe((prev) => Math.max(1, parseInt(prev || "1") - 1).toString())}>
                <Text>-</Text>
              </Button>
              <Text style={styles.inputValue}>{rpe || "7"}</Text>
              <Button onPress={() => setRpe((prev) => Math.min(10, parseInt(prev || "7") + 1).toString())}>
                <Text>+</Text>
              </Button>
            </View>
          </View>

          <Button onPress={handleComplete} style={styles.completeSetButton}>
            <Text style={styles.completeSetButtonText}>Complete Set</Text>
          </Button>
        </View>
      ) : (
        <View style={styles.completedSetInfo}>
          <Text style={styles.completedText}>
            {set.weight}kg × {set.reps} reps {set.rpe && `@ RPE ${set.rpe}`}
          </Text>
        </View>
      )}
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  exitText: {
    color: "#8E8E93",
    fontSize: 17,
  },
  finishText: {
    color: "#B5CFF8",
    fontSize: 17,
    fontWeight: "500",
  },
  timerContainer: {
    alignItems: "center",
  },
  timerText: {
    fontSize: 24,
    fontWeight: "600",
    color: "#1C1C1E",
  },
  workoutTitle: {
    fontSize: 15,
    color: "#8E8E93",
    marginTop: 2,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: 16,
  },
  progressContainer: {
    alignItems: "center",
  },
  progressBar: {
    width: "100%",
    height: 4,
    backgroundColor: "#F2F2F7",
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#B5CFF8",
    borderRadius: 2,
  },
  progressText: {
    fontSize: 13,
    color: "#8E8E93",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  exerciseHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  exerciseName: {
    marginBottom: 4,
  },
  setsContainer: {
    gap: 16,
  },
  setCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F2F2F7",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  setCardCompleted: {
    backgroundColor: "#F8FAFD",
    borderColor: "#B5CFF8",
  },
  setHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  completedBadge: {
    color: "#34C759",
    fontSize: 18,
    fontWeight: "600",
  },
  setInputs: {
    gap: 16,
  },
  inputGroup: {
    alignItems: "center",
  },
  inputLabel: {
    fontSize: 13,
    color: "#8E8E93",
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  inputValue: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1C1C1E",
    minWidth: 40,
    textAlign: "center",
  },
  completeSetButton: {
    backgroundColor: "#B5CFF8",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  completeSetButtonText: {
    color: "#1C1C1E",
    fontWeight: "600",
  },
  completedSetInfo: {
    alignItems: "center",
  },
  completedText: {
    fontSize: 16,
    color: "#34C759",
    fontWeight: "500",
  },
  navigation: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
  },
  navButton: {
    flex: 1,
    marginHorizontal: 8,
  },
  navButtonText: {
    fontSize: 15,
    fontWeight: "500",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  errorTitle: {
    marginBottom: 16,
  },
  errorText: {
    textAlign: "center",
    marginBottom: 32,
  },
  errorButton: {
    backgroundColor: "#B5CFF8",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  errorButtonText: {
    color: "#1C1C1E",
    fontWeight: "600",
  },
});

export default SimpleActiveWorkoutScreen;
