# Implementation Plan

## Overview

Fix UI bugs in the ExerciseDetailScreen workout logging interface to improve user experience and data consistency.

The ExerciseDetailScreen allows users to log exercise sets during workouts, but currently has several UI issues that affect usability. The fixes involve updating exercise data display when navigating between exercises, fixing input field clearing behavior, updating the RPE emoji to use vector icons, removing confusing set number displays, and adding notes to exercise history display. These changes will improve the workout logging flow and make the interface more intuitive and consistent.

## Types

No new type definitions required for these UI fixes.

The existing types in `src/types/index.ts` already support all the required data structures:

- `ExerciseSet` interface includes the `notes` field needed for history display
- `ExerciseSetFormData` interface supports all form data requirements
- Navigation types in `WorkoutStackParamList` support the exercise data passing

## Files

Modifications to existing components to fix UI bugs and improve user experience.

**Files to be modified:**

- `src/screens/workout/ExerciseDetailScreen.tsx` - Fix exercise data updates, remove set number displays, add notes to history
- `src/components/workout/SetLogger.tsx` - Fix input clearing behavior, remove set number from header/button
- `src/components/workout/RPESelector.tsx` - Replace emoji with react-native-vector-icons

**Files to be examined:**

- `src/types/react-native-vector-icons.d.ts` - Verify icon type definitions
- `src/components/workout/CompactRestTimer.tsx` - Reference for vector icon usage patterns

## Functions

Targeted function modifications to fix specific UI behaviors.

**ExerciseDetailScreen.tsx modifications:**

- `handleNextExercise()` - Fix to properly update exercise data when navigating to next exercise
- `renderExerciseHistory()` - Add notes display to history items
- `renderNavigationFooter()` - Remove set number references from navigation buttons

**SetLogger.tsx modifications:**

- `renderHeader()` - Remove set number display from header
- `handleSubmit()` - Fix input clearing behavior to allow proper deletion
- Input change handlers - Ensure proper text input clearing functionality

**RPESelector.tsx modifications:**

- `renderFooter()` - Replace emoji with vector icon in footer text
- Import statements - Add react-native-vector-icons import

## Classes

No new classes required - modifications to existing React functional components.

**Component modifications:**

- ExerciseDetailScreen - Fix state management for exercise navigation and history display
- SetLogger - Fix form input behavior and remove set number displays
- RPESelector - Update icon usage to use vector icons

## Dependencies

No new dependencies required - using existing react-native-vector-icons.

The project already has react-native-vector-icons configured with MaterialIcons, as evidenced by:

- Type definitions in `src/types/react-native-vector-icons.d.ts`
- Usage in `src/components/workout/CompactRestTimer.tsx`
- Import pattern: `import Icon from "react-native-vector-icons/MaterialIcons"`

## Testing

Manual testing approach to verify UI fixes work correctly.

**Test scenarios:**

1. Exercise navigation - Verify exercise details update when clicking "Next: Exercise" button
2. Input clearing - Test that weight/reps inputs can be fully cleared and new values entered
3. Set number removal - Confirm set numbers no longer appear in headers/buttons
4. RPE icon - Verify vector icon displays correctly in RPE selector
5. History notes - Check that notes appear in exercise history when present

**Validation steps:**

- Navigate between exercises and verify all data updates correctly
- Log multiple sets and test input field behavior
- Check exercise history display includes notes
- Verify rest timer updates correctly with exercise changes

## Implementation Order

Sequential implementation to minimize conflicts and ensure proper testing.

1. **Fix ExerciseDetailScreen exercise navigation** - Update `handleNextExercise` to properly pass exercise data and fix state updates
2. **Fix SetLogger input clearing behavior** - Modify input handlers to allow proper text deletion and clearing
3. **Remove set number displays** - Remove set number from SetLogger header and button text, and navigation footer
4. **Update RPE selector icon** - Replace emoji with react-native-vector-icons MaterialIcons
5. **Add notes to exercise history** - Modify history rendering to display notes when available
6. **Test complete workflow** - Verify all fixes work together correctly in the full exercise logging flow
