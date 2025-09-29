# TrainSmart Technical Specification - Comprehensive Edition

> **Version:** 2.0 - Online-First Architecture
> **Last Updated:** August 2025
> **Status:** This document provides comprehensive technical guidance for the TrainSmart application, reflecting the completed migration from offline-first to online-first architecture while preserving all essential development patterns and guidelines.

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Technology Rules & Guidelines](#3-technology-rules--guidelines)
4. [Feature Specifications](#4-feature-specifications)
5. [Data Architecture](#5-data-architecture)
6. [API Specifications](#6-api-specifications)
7. [Security & Privacy](#7-security--privacy)
8. [User Interface Specifications](#8-user-interface-specifications)
9. [Infrastructure & Deployment](#9-infrastructure--deployment)
10. [Implementation Status & Migration Plan](#10-implementation-status--migration-plan)

---

## 1. Executive Summary

### 1.1 Project Overview

TrainSmart is an AI-powered mobile workout tracking application that combines structured progression algorithms with personalized AI coaching. The platform transforms how lifters approach their training journey by providing automated progression recommendations based on RPE (Rate of Perceived Exertion) methodology and context-aware coaching feedback.

**Core Value Proposition:** "The only workout app that actually coaches you through progression"

**Target Market:** Beginner to early-intermediate lifters (3 months - 18 months experience), ages 18-40, seeking structured guidance and systematic progression in their training.

### 1.2 Key Technical Decisions

#### Architecture Evolution: Offline-First → Online-First

The application has successfully migrated from an offline-first to an online-first architecture. This migration simplifies synchronization logic while maintaining responsive user experience through optimistic UI patterns.

**Current Architecture Characteristics:**

- Direct communication with Supabase for all data operations
- Optimistic UI updates for immediate user feedback
- Serverless business logic via Supabase Edge Functions
- Real-time subscriptions for live updates
- Simplified state management without offline queues

### 1.3 Technology Stack

```
Frontend Layer:
├── React Native 0.79.5 (New Architecture enabled)
├── Expo SDK 53 (Managed workflow)
├── Redux Toolkit (State management)
├── React Navigation v6 (Navigation)
└── React Hook Form + Zod (Form validation)

Backend Layer:
├── Supabase PostgreSQL (Primary database)
├── Supabase Edge Functions (Serverless compute)
├── Supabase Auth (Authentication)
├── Supabase Realtime (WebSocket subscriptions)
└── Supabase Storage (File storage)

External Services:
├── OpenAI GPT-4o (AI coaching)
├── Stripe (Payment processing)
└── Sentry (Error monitoring - to be added)
```

---

## 2. System Architecture

### 2.1 Architecture Overview

TrainSmart employs a modern serverless architecture built on Supabase infrastructure, optimized for scalability and developer productivity.

#### Core Architecture Principles

1. **Online-First Operation**

   - All operations assume network connectivity
   - Graceful degradation with clear error messaging
   - No background sync queues or conflict resolution

2. **Optimistic UI Patterns**

   - Immediate UI updates before server confirmation
   - Rollback mechanisms for failed operations
   - Loading states for clarity

3. **Serverless Processing**

   - Business logic in Edge Functions
   - Stateless function design
   - Auto-scaling based on demand

4. **Cost-Controlled AI**
   - Usage tracking per user
   - Budget limits ($1/month per user)
   - Fallback responses when limits reached

#### Data Flow Architecture

```
User Interaction Flow:
1. User Action → React Native UI
2. Optimistic Update → Redux Store
3. API Call → Supabase Client
4. Server Processing → Edge Function (if needed)
5. Database Operation → PostgreSQL
6. Response → Update UI State
7. Real-time Update → WebSocket (if applicable)
```

### 2.2 Component Architecture

```
Application Structure:
├── Presentation Layer
│   ├── Screens (React Native components)
│   ├── Navigation (React Navigation)
│   └── UI Components (Reusable elements)
│
├── Business Logic Layer
│   ├── Services (API communication)
│   ├── Hooks (Business logic hooks)
│   └── Utils (Helper functions)
│
├── State Management Layer
│   ├── Redux Store (Global state)
│   ├── Local State (Component state)
│   └── Context (Theme, Auth)
│
└── Data Layer
    ├── Supabase Client (API interface)
    ├── Storage Adapter (Token persistence)
    └── Cache (AsyncStorage for non-sensitive data)
```

---

## 3. Technology Rules & Guidelines

### 3.1 React Native Development Rules

#### Component Patterns

```typescript
// PSEUDOCODE: Functional Component Pattern
Component Structure:
  - Use functional components with hooks
  - Implement error boundaries for critical sections
  - Provide loading states for async operations
  - Handle empty states explicitly

Example Pattern:
  function WorkoutScreen() {
    // State management
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    // Business logic hooks
    const workout = useCurrentWorkout()
    const { startWorkout } = useWorkoutActions()

    // Error handling
    if (error) return <ErrorView />
    if (loading) return <LoadingView />
    if (!workout) return <EmptyStateView />

    // Main render
    return <WorkoutContent />
  }
```

#### Performance Optimization Rules

**✅ DO:**

- Use FlatList for long lists with proper keyExtractor
- Implement proper image optimization and caching
- Use React.memo for expensive pure components
- Optimize re-renders with proper dependency arrays

**❌ DON'T:**

- Over-memoize simple computations
- Use inline functions in render without need
- Create new objects/arrays in render
- Nest FlatLists without virtualization

### 3.2 Code Simplicity Guidelines

#### Anti-Patterns to Avoid

```typescript
// ❌ AVOID: Over-engineered patterns

// Over-memoization
const simpleValue = useMemo(() => user.email, [user.email]) // Unnecessary

// Excessive abstraction
class SingletonAuthService {
  private static instance: AuthService
  // Complex singleton pattern for simple service
}

// Over-complicated hooks
const useFormWithDebounceAndValidation = (
  schema,
  options: {
    debounceMs: 300,
    validateOnChange: true,
    trackInteractions: true,
    // Too many options
  }
)

// ✅ PREFER: Simple, direct patterns

// Direct value access
const email = user.email

// Simple module exports
export const authService = {
  signIn: async (credentials) => { /* implementation */ },
  signOut: async () => { /* implementation */ }
}

// Straightforward state management
const [errors, setErrors] = useState({})
const validateEmail = (email) => { /* simple validation */ }
```

#### Service Architecture Pattern

```typescript
// PSEUDOCODE: Simple Service Pattern
Service Module Structure:
  // Direct function exports
  export async function createWorkout(data) {
    // Validate input
    // Call Supabase
    // Handle errors
    // Return result
  }

  export async function updateWorkout(id, updates) {
    // Similar pattern
  }

  // Optional: Group related functions
  export const workoutService = {
    create: createWorkout,
    update: updateWorkout,
    delete: deleteWorkout
  }
```

### 3.3 Input Handling Guidelines

#### Critical: iOS Keyboard Focus Pattern

Due to iOS keyboard focus issues with wrapper components, use direct TextInput components with centralized style constants.

```typescript
// ✅ CORRECT: Direct TextInput Pattern
Component with Direct TextInput:
  import { INPUT_STYLES, getInputStyle } from '@/styles/inputStyles'

  function EmailField() {
    const [focused, setFocused] = useState(false)
    const [error, setError] = useState(null)

    return (
      <View>
        <Text>Email Address *</Text>
        <TextInput
          style={getInputStyle(
            'default',
            { focused, error: !!error }
          )}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          // Direct props, no wrapper
        />
        {error && <Text>{error}</Text>}
      </View>
    )
  }

// ❌ INCORRECT: Wrapper Component Pattern
Component with Wrapper:
  // This causes iOS keyboard focus issues
  <CustomInput
    label="Email"
    value={email}
    onChangeText={setEmail}
  />
```

#### Form Integration Pattern

```typescript
// PSEUDOCODE: React Hook Form Integration
Form with Validation:
  const form = useForm({
    resolver: zodResolver(schema),
    mode: 'onSubmit'
  })

  <Controller
    name="email"
    control={form.control}
    render={({ field, fieldState }) => (
      <View>
        <TextInput
          style={getInputStyle(state)}
          value={field.value}
          onChangeText={field.onChange}
          // Direct TextInput usage
        />
        {fieldState.error && <ErrorText />}
      </View>
    )}
  />
```

### 3.4 State Management Patterns

#### Redux Toolkit Usage

```typescript
// PSEUDOCODE: Redux Slice Pattern
Slice Structure:
  const workoutSlice = createSlice({
    name: 'workout',
    initialState: {
      current: null,
      isActive: false,
      sets: []
    },
    reducers: {
      // Synchronous updates
      startWorkout: (state, action) => {
        state.current = action.payload
        state.isActive = true
      }
    },
    extraReducers: (builder) => {
      // Async thunk handling
      builder.addCase(fetchWorkout.fulfilled, (state, action) => {
        state.current = action.payload
      })
    }
  })
```

#### Optimistic Update Pattern

```typescript
// PSEUDOCODE: Optimistic Updates
Optimistic Update Flow:
  async function addSet(setData) {
    // 1. Generate temporary ID
    const tempId = `temp_${Date.now()}`

    // 2. Update UI immediately
    dispatch(addSetOptimistic({ ...setData, id: tempId }))

    try {
      // 3. Call server
      const serverSet = await api.createSet(setData)

      // 4. Replace temp with real data
      dispatch(replaceSet({ tempId, serverSet }))
    } catch (error) {
      // 5. Rollback on failure
      dispatch(removeSet(tempId))
      dispatch(showError(error.message))
    }
  }
```

### 3.5 Error Handling Patterns

```typescript
// PSEUDOCODE: Comprehensive Error Handling
Error Handling Strategy:

  // Service level
  async function fetchData() {
    try {
      const result = await supabase.from('table').select()
      if (result.error) throw new AppError(result.error)
      return result.data
    } catch (error) {
      // Log to monitoring
      logger.error('Fetch failed', error)

      // Return user-friendly error
      throw new UserError('Unable to load data. Please try again.')
    }
  }

  // Component level
  function Component() {
    const [error, setError] = useState(null)

    const loadData = async () => {
      try {
        await fetchData()
      } catch (error) {
        setError(error.userMessage || 'Something went wrong')
      }
    }

    if (error) {
      return <ErrorView message={error} onRetry={loadData} />
    }
  }
```

---

## 4. Feature Specifications

### 4.1 Authentication & Profile Management

#### Current Status: ✅ WORKING

**Implementation Overview:**

- Supabase Auth with email/password authentication
- Token persistence via SecureStore (native) and encrypted storage (web)
- Profile creation on verified sign-in
- Online-first with no offline token refresh

```typescript
// PSEUDOCODE: Authentication Flow
Authentication Service:

  signUp(email, password, profile):
    // Create auth user
    const authResult = await supabase.auth.signUp({
      email,
      password,
      options: { data: profile }
    })

    // Profile created via database trigger
    return authResult

  signIn(email, password):
    // Authenticate
    const session = await supabase.auth.signIn({ email, password })

    // Store tokens securely
    await SecureStore.setItem('access_token', session.access_token)
    await SecureStore.setItem('refresh_token', session.refresh_token)

    // Initialize user profile if needed
    await profileService.ensureProfile(session.user.id)

    return session

  signOut():
    // Clear tokens
    await SecureStore.deleteItem('access_token')
    await SecureStore.deleteItem('refresh_token')

    // Sign out from Supabase
    await supabase.auth.signOut()
```

### 4.2 Workout Tracking System

#### Current Status: ✅ WORKING (Online-First)

**Implementation Overview:**

- Direct server writes with optimistic UI updates
- Temporary IDs replaced with server IDs on success
- No offline queue or background sync
- Real-time updates for collaborative features

```typescript
// PSEUDOCODE: Workout Tracking
Workout Service:

  startWorkout(planId):
    // Create workout session
    const workout = {
      id: generateTempId(),
      planId,
      startedAt: new Date(),
      status: 'active'
    }

    // Optimistic update
    dispatch(setCurrentWorkout(workout))

    // Server persistence
    const serverWorkout = await supabase
      .from('workout_sessions')
      .insert(workout)
      .select()
      .single()

    // Update with server data
    dispatch(updateWorkout(serverWorkout))

    return serverWorkout

  addSet(exerciseId, setData):
    // Similar optimistic pattern
    const tempSet = { id: generateTempId(), ...setData }
    dispatch(addSetOptimistic(tempSet))

    const serverSet = await supabase
      .from('exercise_sets')
      .insert(setData)
      .select()
      .single()

    dispatch(replaceSet({ tempId: tempSet.id, serverSet }))
```

### 4.3 AI Coaching System

#### Current Status: ⚠️ NEEDS REVIEW

**Implementation Overview:**

- OpenAI GPT-4o integration with cost controls
- $1/month per user budget limit
- Fallback responses when limits exceeded
- Context-aware coaching based on workout history

```typescript
// PSEUDOCODE: AI Coaching Service
AI Service:

  async generateCoaching(userId, query, context):
    // Check usage limits
    const usage = await checkUserUsage(userId)
    if (usage.monthlySpent >= 1.00) {
      return generateFallbackResponse('limit_exceeded')
    }

    // Build optimized prompt
    const prompt = buildPrompt(query, context, {
      maxTokens: 500,
      includeHistory: true,
      optimizeForCost: true
    })

    // Select appropriate model
    const model = selectModel(query) // gpt-3.5-turbo for simple, gpt-4o for complex

    // Call OpenAI
    const response = await openai.complete({
      model,
      prompt,
      maxTokens: 500
    })

    // Track usage
    await trackUsage(userId, response.usage)

    return response
```

**Required Updates:**

- Verify OpenAI model names and pricing in constants
- Update cost calculations for current pricing
- Test fallback response generation

### 4.4 Progress & Analytics

#### Current Status: ⚠️ PARTIALLY IMPLEMENTED

**Implementation Overview:**

- Progress dashboard exists but needs server endpoint alignment
- Personal records calculation implemented
- Charts and visualizations using \*decide later
- Some features behind temporary feature gates

```typescript
// PSEUDOCODE: Progress Analytics
Progress Service:

  getProgressMetrics(userId, timeframe):
    // Fetch aggregated data
    const metrics = await supabase.rpc('calculate_progress', {
      user_id: userId,
      start_date: timeframe.start,
      end_date: timeframe.end
    })

    return {
      totalVolume: metrics.total_volume,
      workoutCount: metrics.workout_count,
      averageRPE: metrics.avg_rpe,
      strengthGains: calculateStrengthGains(metrics.exercises),
      personalRecords: extractPersonalRecords(metrics.exercises)
    }

  getExerciseProgress(userId, exerciseId):
    // Fetch exercise-specific progress
    const history = await supabase
      .from('exercise_sets')
      .select('*')
      .eq('user_id', userId)
      .eq('exercise_id', exerciseId)
      .order('created_at', { ascending: false })
      .limit(100)

    return processExerciseHistory(history)
```

**Required Updates:**

- Complete server-side RPC functions for analytics
- Remove temporary feature gates after testing
- Align chart components with actual data shapes

### 4.5 Subscription Management

#### Current Status: ✅ IMPLEMENTED

**Implementation Overview:**

- Stripe integration for payment processing
- Temporary subscription system for testing
- Edge functions for webhook handling
- Three tiers: Free, Premium ($9.99), Coach ($29.99)

```typescript
// PSEUDOCODE: Subscription Management
Subscription Service:

  upgradeToPremium(userId):
    // Create Stripe checkout session
    const session = await createCheckoutSession({
      userId,
      priceId: PREMIUM_PRICE_ID,
      successUrl: 'app://subscription/success',
      cancelUrl: 'app://subscription/cancel'
    })

    // Open Stripe checkout
    await openStripeCheckout(session.url)

    // Webhook handles completion

  handleWebhook(event):
    switch(event.type) {
      case 'checkout.session.completed':
        await activateSubscription(event.data)
        break
      case 'invoice.payment_failed':
        await handlePaymentFailure(event.data)
        break
    }
```

---

## 5. Data Architecture

### 5.1 Database Schema

#### Current Schema Status

The database contains legacy columns from the offline-first architecture that need removal:

- `workout_sessions.sync_status` (deprecated)
- `workout_sessions.offline_created` (deprecated)

```sql
-- PSEUDOCODE: Core Database Tables

-- User Profiles (extends Supabase Auth)
TABLE user_profiles:
  id UUID PRIMARY KEY (references auth.users)
  display_name TEXT
  email TEXT
  experience_level ENUM('untrained', 'beginner', 'early_intermediate')
  height_cm INTEGER
  weight_kg DECIMAL
  use_metric BOOLEAN DEFAULT true
  privacy_settings JSONB
  created_at TIMESTAMP
  updated_at TIMESTAMP

-- Workout Sessions (online-first)
TABLE workout_sessions:
  id UUID PRIMARY KEY
  user_id UUID (references user_profiles)
  plan_id UUID (references workout_plans)
  name TEXT
  started_at TIMESTAMP
  completed_at TIMESTAMP
  duration_minutes INTEGER
  notes TEXT
  -- Legacy columns to remove:
  -- sync_status ENUM (deprecated)
  -- offline_created BOOLEAN (deprecated)

-- Exercise Sets
TABLE exercise_sets:
  id UUID PRIMARY KEY
  session_id UUID (references workout_sessions)
  exercise_id UUID (references exercises)
  set_number INTEGER
  weight_kg DECIMAL
  reps INTEGER
  rpe INTEGER (1-10)
  is_warmup BOOLEAN
  rest_seconds INTEGER

-- AI Usage Tracking
TABLE ai_usage_tracking:
  id UUID PRIMARY KEY
  user_id UUID (references user_profiles)
  query_type TEXT
  tokens_used INTEGER
  estimated_cost DECIMAL
  model_used TEXT
  created_at TIMESTAMP
```

### 5.2 Row Level Security

```sql
-- PSEUDOCODE: RLS Policies

-- Users can only access their own data
POLICY user_data_isolation:
  ON user_profiles, workout_sessions, exercise_sets
  FOR ALL OPERATIONS
  USING (auth.uid() = user_id)

-- Premium features require active subscription
POLICY premium_features:
  ON ai_conversations, custom_workouts
  FOR ALL OPERATIONS
  USING (
    EXISTS (
      SELECT 1 FROM subscriptions
      WHERE user_id = auth.uid()
      AND status = 'active'
      AND plan_id IN ('premium', 'coach')
    )
  )
```

### 5.3 Migration Strategy

```sql
-- PSEUDOCODE: Safe Migration Steps

-- Step 1: Set safe defaults (non-destructive)
UPDATE workout_sessions
SET sync_status = 'synced'
WHERE sync_status IS NULL;

UPDATE workout_sessions
SET offline_created = false
WHERE offline_created IS NULL;

-- Step 2: Verify no code dependencies
-- Run codebase search for column references

-- Step 3: Drop columns (after verification)
ALTER TABLE workout_sessions
DROP COLUMN sync_status,
DROP COLUMN offline_created;
```

---

## 6. API Specifications

### 6.1 Internal APIs (Supabase Edge Functions)

#### Authentication Endpoints

```typescript
// PSEUDOCODE: Auth Endpoints

POST /auth/signup
  Request: {
    email: string
    password: string (min 12 chars)
    profile: {
      displayName: string
      experienceLevel: string
      goals: string[]
    }
  }
  Response: {
    user: { id, email, emailConfirmed }
    session: { accessToken, refreshToken, expiresAt }
  }

POST /auth/signin
  Request: { email, password }
  Response: { user, session }

POST /auth/refresh
  Request: { refreshToken }
  Response: { session }

POST /auth/signout
  Request: { accessToken }
  Response: { success: boolean }
```

#### Workout Management Endpoints

```typescript
// PSEUDOCODE: Workout Endpoints

POST /workouts/start
  Request: {
    planId?: string
    name: string
  }
  Response: {
    workout: { id, startedAt, status }
  }

POST /workouts/:id/sets
  Request: {
    exerciseId: string
    weight: number
    reps: number
    rpe: number
  }
  Response: {
    set: { id, ...setData }
  }

POST /workouts/:id/complete
  Request: {
    notes?: string
  }
  Response: {
    workout: { ...completedWorkout }
    summary: { totalVolume, duration, avgRPE }
  }

GET /workouts/history
  Query: { startDate?, endDate?, limit? }
  Response: {
    workouts: Workout[]
    pagination: { total, page, hasMore }
  }
```

#### AI Coaching Endpoints

```typescript
// PSEUDOCODE: AI Endpoints

POST /ai/query
  Request: {
    query: string
    context: {
      includeRecentWorkouts?: boolean
      includeProgress?: boolean
    }
  }
  Response: {
    response: string
    tokensUsed: number
    cost: number
    remainingBudget: number
  }

GET /ai/usage
  Response: {
    monthlyUsage: number
    monthlyLimit: 1.00
    resetDate: string
  }

POST /ai/monthly-review
  Request: { month: string }
  Response: {
    review: {
      summary: string
      achievements: string[]
      recommendations: string[]
    }
  }
```

### 6.2 External Service Integrations

#### OpenAI Integration

```typescript
// PSEUDOCODE: OpenAI Service

OpenAI Service Configuration:
  - API Key: Environment variable
  - Models: gpt-3.5-turbo (simple), gpt-4o (complex)
  - Max tokens: 500 per request
  - Temperature: 0.7

Cost Optimization:
  - Token estimation before API call
  - Model selection based on query complexity
  - Prompt compression techniques
  - Response caching for common queries
```

#### Stripe Integration

```typescript
// PSEUDOCODE: Stripe Service

Stripe Configuration:
  - Publishable Key: Client-side
  - Secret Key: Server-side only
  - Webhook Secret: For signature verification

Subscription Flow:
  1. Create checkout session
  2. Redirect to Stripe checkout
  3. Handle webhook events
  4. Update subscription status
  5. Grant/revoke feature access
```

---

## 7. Security & Privacy

### 7.1 Authentication Security

```typescript
// PSEUDOCODE: Security Measures

Token Management:
  - Access tokens: 1 hour expiry
  - Refresh tokens: 7 days expiry
  - Secure storage: SecureStore (native), encrypted (web)
  - Auto-refresh: 5 minutes before expiry

Session Security:
  - HTTPS only
  - Secure cookie flags
  - CSRF protection
  - Rate limiting on auth endpoints
```

### 7.2 Data Protection

```typescript
// PSEUDOCODE: Data Protection

Encryption:
  - At rest: Database encryption (Supabase managed)
  - In transit: TLS 1.3
  - Sensitive data: Additional application-level encryption

PII Handling:
  - Minimal data collection
  - User consent for data usage
  - Right to deletion (CCPA/GDPR)
  - Data export functionality
```

### 7.3 Input Validation

```typescript
// PSEUDOCODE: Validation Patterns

Input Validation:
  // Email validation
  validateEmail(email):
    - Format check: regex pattern
    - Length check: max 254 chars
    - Sanitization: trim, lowercase

  // Password validation
  validatePassword(password):
    - Length: min 12 characters
    - Complexity: uppercase, lowercase, number
    - Common password check
    - No personal info (email, name)

  // Workout data validation
  validateWorkoutData(data):
    - Weight: 0-1000 kg
    - Reps: 0-1000
    - RPE: 1-10
    - SQL injection prevention
```

---

## 8. User Interface Specifications

### 8.1 Design System

#### Color System

```typescript
// PSEUDOCODE: Color Palette

Primary Colors:
  blue: #B5CFF8      // Primary actions, coaching
  white: #FFFFFF     // Clean backgrounds
  dark: #1C1C1E      // Text and dark surfaces

Secondary Colors:
  blueLight: #D7E4FD // Hover states
  gray: #F2F2F7      // Backgrounds
  blueDeep: #87B1F3  // Dark mode emphasis

Semantic Colors:
  success: #34C759   // Completed workouts
  progress: #64D2FF  // Progressive overload
  warning: #FF9500   // RPE warnings
  error: #FF3B30     // Errors and failures

Usage Guidelines:
  - Primary blue maintains 4.8:1 contrast ratio
  - All text meets WCAG AA standards
  - Dark mode uses adjusted palette
```

#### Typography System

```typescript
// PSEUDOCODE: Typography Scale

Font Families:
  primary: SF Pro Text (iOS native)
  display: SF Pro Display (20pt+)
  fallback: Inter (web/cross-platform)

Type Scale:
  h1: { size: 34, weight: 700, usage: "Screen titles" }
  h2: { size: 28, weight: 700, usage: "Section headers" }
  h3: { size: 22, weight: 600, usage: "Subsections" }
  body: { size: 15, weight: 400, usage: "Standard text" }
  button: { size: 17, weight: 500, usage: "CTAs" }
  caption: { size: 11, weight: 500, usage: "Metadata" }
```

#### Spacing System

```typescript
// PSEUDOCODE: Spacing Scale

Base Unit: 4px

Scale:
  xs: 4   // Micro spacing
  sm: 8   // Internal padding
  md: 12  // Default spacing
  lg: 16  // Card padding
  xl: 20  // Section spacing
  xxl: 24 // Major sections
  xxxl: 32 // Screen margins

Component Spacing:
  card: { padding: 16, margin: 8 }
  form: { fieldGap: 16, sectionGap: 32 }
  list: { itemGap: 8, groupGap: 16 }
```

### 8.2 Component Patterns

#### Button Components

```typescript
// PSEUDOCODE: Button Styles

Primary Button:
  background: #B5CFF8
  text: #1C1C1E
  height: 50
  borderRadius: 12
  states: {
    pressed: opacity(0.8), scale(0.98)
    disabled: opacity(0.4)
  }

Secondary Button:
  background: transparent
  border: 2px solid #B5CFF8
  text: #B5CFF8

Text Button:
  background: transparent
  text: #B5CFF8
  underlineOnPress: true
```

#### Form Fields

```typescript
// PSEUDOCODE: Input Styles

Text Input:
  height: 52
  borderRadius: 12
  borderWidth: 1.5
  padding: 16
  fontSize: 17
  states: {
    default: { borderColor: #8E8E93 }
    focused: { borderColor: #B5CFF8, borderWidth: 2 }
    error: { borderColor: #FF3B30 }
    success: { borderColor: #34C759 }
  }
```

### 8.3 Animation System

```typescript
// PSEUDOCODE: Animation Patterns

Standard Transitions:
  duration: 250ms
  easing: ease-out
  usage: Navigation, button presses

Spring Animations:
  tension: 300
  friction: 10
  usage: Coaching feedback, RPE updates

Progressive Overload:
  duration: 400ms
  easing: cubic-bezier(0.25, 0.8, 0.25, 1)
  usage: Weight progression indicators
```

---

## 9. Infrastructure & Deployment

### 9.1 Infrastructure Architecture

```typescript
// PSEUDOCODE: Infrastructure Setup

Supabase Configuration:
  Database:
    tier: Pro (for point-in-time recovery)
    region: us-east-1
    backups: Daily, 7-day retention

  Edge Functions:
    runtime: Deno 2.1+
    memory: 512MB per function
    timeout: 30s max
    regions: [us-east-1, eu-west-1]

  Storage:
    buckets: {
      avatars: { public: true, maxSize: 5MB }
      workouts: { public: false, maxSize: 10MB }
    }
```

### 9.2 Deployment Pipeline

```yaml
# PSEUDOCODE: CI/CD Pipeline

Pipeline Stages:
  1. Test:
    - Type checking
    - Unit tests
    - Lint checks

  2. Build:
    - iOS: EAS Build
    - Android: EAS Build
    - Web: Expo export

  3. Deploy:
    - Edge Functions: Supabase CLI
    - Web: Netlify
    - Mobile: App stores

  4. Monitor:
    - Error tracking: Sentry
```

### 9.3 Environment Configuration

```typescript
// PSEUDOCODE: Environment Variables

Development: EXPO_PUBLIC_SUPABASE_URL: local.supabase.url;
EXPO_PUBLIC_SUPABASE_ANON_KEY: local.anon.key;
OPENAI_API_KEY: dev.openai.key;
STRIPE_SECRET_KEY: test.stripe.key;
SENTRY_DSN: dev.sentry.dsn;

Staging: EXPO_PUBLIC_SUPABASE_URL: staging.supabase.url;
EXPO_PUBLIC_SUPABASE_ANON_KEY: staging.anon.key;
OPENAI_API_KEY: staging.openai.key;
STRIPE_SECRET_KEY: test.stripe.key;
SENTRY_DSN: staging.sentry.dsn;

Production: EXPO_PUBLIC_SUPABASE_URL: prod.supabase.url;
EXPO_PUBLIC_SUPABASE_ANON_KEY: prod.anon.key;
OPENAI_API_KEY: prod.openai.key;
STRIPE_SECRET_KEY: live.stripe.key;
SENTRY_DSN: prod.sentry.dsn;
```

---

## 10. Implementation Status & Migration Plan

### 10.1 Current Implementation Status

#### ✅ Completed Features

**Authentication & Profile Management**

- Email/password authentication via Supabase Auth
- Token persistence with SecureStore
- Profile creation and editing
- Privacy settings management
- Online-first session management

**Workout Tracking**

- Workout session creation and management
- Exercise set logging with RPE
- Optimistic UI updates
- Direct server persistence
- Exercise history tracking

**Subscription System**

- Stripe integration for payments
- Temporary subscription system for testing
- Webhook handling via Edge Functions
- Three-tier pricing model

#### ⚠️ Features Needing Updates

**AI Coaching System**

- Verify OpenAI model names and pricing
- Update cost calculation constants
- Test fallback response generation
- Validate monthly budget limits

**Progress & Analytics**

- Complete server-side RPC functions
- Remove temporary feature gates
- Align chart components with data shapes
- Wire up analytics endpoints

#### ❌ Deprecated/To Remove

**Legacy Offline-First Code**

- Database columns: `sync_status`, `offline_created`
- Hooks: `useNetworkStatus`, `useWorkoutSync`
- Sync queue implementations
- Conflict resolution UI

### 10.2 Migration Tasks

#### Phase 1: Documentation & Type Updates (Week 1)

```typescript
// PSEUDOCODE: Documentation Updates

Tasks:
  1. Update all TypeScript types to remove offline references
  2. Update API documentation
  3. Remove deprecated hook imports
  4. Update component documentation

Commands:
  # Find deprecated imports
  grep -r "useNetworkStatus\|useWorkoutSync" src/

  # Type check entire codebase
  npm run type-check
```

#### Phase 2: Database Migration (Week 2)

```sql
-- PSEUDOCODE: Safe Database Migration

-- Step 1: Create migration file
CREATE MIGRATION remove_offline_columns

-- Step 2: Set safe defaults
UPDATE workout_sessions
SET sync_status = 'synced'
WHERE sync_status IS NULL;

-- Step 3: Verify no active dependencies
SELECT COUNT(*) FROM workout_sessions
WHERE sync_status != 'synced';

-- Step 4: Drop columns (after verification)
ALTER TABLE workout_sessions
DROP COLUMN IF EXISTS sync_status,
DROP COLUMN IF EXISTS offline_created;
```

#### Phase 3: AI System Updates (Week 3)

```typescript
// PSEUDOCODE: AI System Updates

Tasks:
  1. Update OpenAI model constants
  2. Verify pricing calculations
  3. Test fallback responses
  4. Validate usage tracking

Testing:
  - Unit tests for cost calculations
  - Integration tests for API calls
  - E2E tests for budget limits
```

#### Phase 4: Progress Feature Completion (Week 4)

```typescript
// PSEUDOCODE: Progress Feature Updates

Tasks:
  1. Create RPC functions for analytics
  2. Remove feature gates
  3. Update chart components
  4. Test data visualization

Implementation:
  // Create RPC function
  CREATE FUNCTION calculate_progress(
    user_id UUID,
    start_date DATE,
    end_date DATE
  ) RETURNS TABLE (...)
```

#### Phase 5: Monitoring & Error Tracking (Week 5)

```typescript
// PSEUDOCODE: Add Sentry Integration

Installation:
  npm install @sentry/expo

Configuration:
  // src/lib/sentry.ts
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    integrations: [
      new Sentry.ReactNativeTracing()
    ]
  })

Integration:
  // App.tsx
  import './lib/sentry'

  // Wrap app with error boundary
  <Sentry.ErrorBoundary>
    <App />
  </Sentry.ErrorBoundary>
```

### 10.3 Testing Strategy

#### Unit Testing

```typescript
// PSEUDOCODE: Unit Test Coverage

Test Suites:
  - Authentication service: 90% coverage
  - Workout service: 85% coverage
  - AI service: 80% coverage
  - Progress calculations: 95% coverage

Run Tests:
  npm run test
  npm run test:coverage
```

#### Integration Testing

```typescript
// PSEUDOCODE: Integration Tests

Test Scenarios:
  1. User signup → profile creation → first workout
  2. Workout creation → set logging → completion
  3. AI query → usage tracking → budget enforcement
  4. Subscription → payment → feature access

Run Tests:
  npm run test:integration
```

#### E2E Testing

```typescript
// PSEUDOCODE: E2E Test Flows

Critical Paths:
  1. Complete onboarding flow
  2. Log first workout
  3. View progress dashboard
  4. Upgrade subscription

Run Tests:
  npx detox test --configuration ios.sim.release
  npx detox test --configuration android.emu.release
```

### 10.4 Rollback Procedures

#### Database Rollback

```sql
-- PSEUDOCODE: Rollback Migration

-- Restore columns if needed
ALTER TABLE workout_sessions
ADD COLUMN sync_status sync_status_enum DEFAULT 'synced',
ADD COLUMN offline_created BOOLEAN DEFAULT false;

-- Restore data from backup
RESTORE TABLE workout_sessions
FROM BACKUP '2025-08-27';
```

#### Code Rollback

```bash
# PSEUDOCODE: Git Rollback

# Identify last stable commit
git log --oneline

# Create rollback branch
git checkout -b rollback/offline-removal

# Revert to stable commit
git revert HEAD~5..HEAD

# Deploy rollback
npm run deploy:emergency
```

### 10.5 Success Metrics

#### Performance Metrics

```typescript
// PSEUDOCODE: Performance Targets

Targets:
  - API response time: < 200ms (p95)
  - App startup time: < 2s
  - Workout sync time: < 500ms
  - AI response time: < 3s

Monitoring:
  - Supabase dashboard metrics
  - Sentry performance monitoring
  - Custom analytics events
```

#### Business Metrics

```typescript
// PSEUDOCODE: Business KPIs

Metrics:
  - User retention: > 60% (30-day)
  - Workout completion rate: > 80%
  - AI usage per user: 10-20 queries/month
  - Subscription conversion: > 5%

Tracking:
  - Google Analytics
  - Supabase analytics views
  - Custom dashboard
```

### 10.6 Maintenance Schedule

#### Regular Maintenance

```yaml
# PSEUDOCODE: Maintenance Tasks

Daily:
  - Monitor error rates
  - Check AI usage budgets
  - Review performance metrics

Weekly:
  - Database vacuum and analyze
  - Review user feedback
  - Update dependencies (patch)

Monthly:
  - Security updates
  - Performance optimization
  - Feature flag review
  - Cost analysis

Quarterly:
  - Major dependency updates
  - Architecture review
  - Security audit
  - Disaster recovery test
```

### 10.7 Documentation Maintenance

#### Documentation Updates

```typescript
// PSEUDOCODE: Documentation Process

When to Update:
  - New feature implementation
  - API changes
  - Architecture modifications
  - Bug fixes affecting behavior

Documentation Locations:
  - Technical specification (this document)
  - API documentation
  - Code comments
  - README files
  - Migration guides

Review Schedule:
  - Weekly: Code comments
  - Monthly: API docs
  - Quarterly: Technical specification
  - Annually: Full documentation audit
```

---

## Appendix A: Quick Reference

### Common Commands

```bash
# Development
npm run dev                 # Start development server
npm run ios                 # Run iOS simulator
npm run android            # Run Android emulator
npm run web                # Run web version

# Testing
npm run test               # Run unit tests
npm run test:coverage      # Run tests with coverage
npm run test:e2e          # Run E2E tests
npm run lint              # Run linter
npm run type-check        # Check TypeScript

# Deployment
npm run build:ios         # Build iOS app
npm run build:android     # Build Android app
npm run build:web        # Build web app
npm run deploy:functions  # Deploy Edge Functions

# Database
npm run db:migrate        # Run migrations
npm run db:seed          # Seed database
npm run db:reset         # Reset database
```

### Environment Setup

```bash
# Clone repository
git clone https://github.com/username/trainsmart.git
cd trainsmart

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your values

# Start development
npm run dev
```

### Troubleshooting

```typescript
// PSEUDOCODE: Common Issues

Issue: iOS keyboard focus problems
Solution: Use direct TextInput, not wrapper components

Issue: Optimistic update rollback
Solution: Check tempId replacement logic

Issue: AI budget exceeded
Solution: Verify cost calculations and limits

Issue: Subscription webhook failures
Solution: Check Stripe webhook secret and endpoint

Issue: Database migration errors
Solution: Verify column dependencies before dropping
```

---

**End of Technical Specification v2.0**

_Last Updated: August 2025_
_Next Review: November 2025_
