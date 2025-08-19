# Implementation Plan

## Overview

Fix exercise set logging failures and clean up database/service layer redundancies while maintaining a simple, reliable online-first workout tracking system.

The core issue is a foreign key constraint violation where exercise IDs used in the app don't exist in the database, combined with redundant service layers and premature ID generation causing duplicate key errors. This plan addresses the immediate logging failure while streamlining the architecture for better maintainability.

## Types

Update and consolidate type definitions to ensure consistency between database and application layers.

**Database Types (src/types/database.ts):**

- Ensure all exercise set fields are properly typed
- Add proper null handling for optional fields
- Standardize UUID vs string types

**Application Types (src/types/index.ts):**

- Consolidate ExerciseSet interface with proper optional fields
- Remove redundant offline-related types
- Ensure WorkoutSession type matches actual usage patterns

**Transform Types (src/types/transforms.ts):**

- Fix transformExerciseSetToDb to handle undefined/null values properly
- Add validation for required fields before database operations
- Remove transformation complexity for unused fields

## Files

Consolidate and fix database operations while removing redundant code paths.

**Files to Modify:**

- `src/services/database.service.ts` - Remove redundant workout operations, keep only data fetching
- `src/services/workout.service.ts` - Fix duplicate insertion logic, remove premature ID generation
- `src/store/workout/workoutSlice.ts` - Simplify state management, remove offline queue remnants
- `src/types/transforms.ts` - Fix null/undefined handling in transformations
- `supabase/seed.sql` - Verify all referenced exercise IDs are properly seeded

**Files to Create:**

- `src/services/exercise.service.ts` - Dedicated service for exercise data management
- `src/utils/exerciseValidation.ts` - Validation utilities for exercise IDs and data

**Configuration Updates:**

- Update any hardcoded exercise IDs to match seeded data
- Ensure database constraints are properly handled in application logic

## Functions

Streamline database operations and fix the core insertion logic issues.

**New Functions:**

- `validateExerciseExists(exerciseId: string): Promise<boolean>` - Validate exercise ID before set creation
- `getExerciseIdMapping(): Promise<Map<string, string>>` - Map exercise names to valid IDs
- `sanitizeSetData(setData: Partial<ExerciseSet>): DbExerciseSet` - Clean data before database insertion

**Modified Functions:**

- `WorkoutService.startWorkout()` - Remove duplicate insertion logic, let database generate IDs
- `WorkoutService.addExerciseSet()` - Add exercise validation, fix transformation issues
- `DatabaseService.insertExerciseSets()` - Simplify to single insertion path, remove offline fallbacks
- `transformExerciseSetToDb()` - Fix null/undefined handling for optional fields

**Removed Functions:**

- All offline queue management functions
- Duplicate workout session creation methods
- Complex sync status management functions

## Classes

Consolidate service responsibilities and remove architectural complexity.

**Modified Classes:**

- `WorkoutService` - Focus on workout session lifecycle, remove offline complexity
- `DatabaseService` - Focus on data fetching and caching, remove workout creation logic

**New Classes:**

- `ExerciseService` - Handle exercise data validation and management
- `ValidationService` - Centralized data validation before database operations

**Removed Classes:**

- Any offline sync related classes
- Redundant data transformation classes

## Dependencies

No new external dependencies required - focus on better utilizing existing Supabase client.

**Existing Dependencies to Better Utilize:**

- Supabase client for proper error handling and constraint validation
- Redux Toolkit for simplified state management
- React Native AsyncStorage for minimal local caching only

**Remove Dependencies On:**

- Complex offline sync mechanisms
- Redundant data transformation libraries
- Unused analytics and materialized view dependencies

## Testing

Comprehensive testing strategy focusing on data integrity and error handling.

**Unit Tests:**

- Exercise ID validation functions
- Data transformation with null/undefined values
- Database constraint error handling

**Integration Tests:**

- Complete workout session creation and set logging flow
- Exercise data fetching and validation
- Error scenarios with proper user feedback

**Database Tests:**

- Verify all seeded exercises have valid IDs
- Test foreign key constraints work as expected
- Validate data transformation accuracy

## Implementation Order

Logical sequence to fix immediate issues while maintaining system stability.

1. **Fix Exercise Data Consistency** - Verify and fix exercise IDs in database vs app
2. **Consolidate Workout Service** - Remove duplicate insertion logic and fix ID generation
3. **Add Exercise Validation** - Implement validation before database operations
4. **Clean Up Database Service** - Remove redundant workout operations
5. **Update Type Transformations** - Fix null/undefined handling
6. **Remove Offline Remnants** - Clean up unused offline sync code
7. **Add Comprehensive Error Handling** - Proper user feedback for constraint violations
8. **Test Complete Flow** - Verify exercise set logging works end-to-end
