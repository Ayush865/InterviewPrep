# Interview Map Implementation

## Overview
This implementation adds an `interviews` map to the users collection in Firebase. When a user creates or takes an interview, the interview ID is stored in this map, allowing for efficient tracking of all interviews associated with a user.

## Changes Made

### 1. User Document Structure
Each user document now includes an `interviews` field:
```javascript
{
  email: "user@example.com",
  name: "John Doe",
  interviews: {
    "interview_id_1": DocumentReference(interviews/interview_id_1),
    "interview_id_2": DocumentReference(interviews/interview_id_2),
    // ... more interview references
  }
}
```

**Note**: The values in the map are Firebase DocumentReferences, not boolean values. This provides:
- Direct reference to the interview document
- Referential integrity
- Efficient lookups without needing to construct paths

### 2. Updated Files

#### `app/api/webhooks/clerk/route.ts`
- **What changed**: User creation/update now initializes the `interviews` map
- **When**: When a new user signs up via Clerk authentication
- **Result**: All new users start with an empty `interviews: {}` object

#### `lib/actions/general.action.ts`
- **New function**: `addInterviewToUserMap(userId, interviewId)`
  - Adds an interview ID to a user's interview map
  - Called when creating feedback (taking an interview)
  
- **Updated function**: `getInterviewsByUserId(userId)`
  - **Old behavior**: Queried interviews collection for all interviews where `userId` matches
  - **New behavior**: 
    1. Fetches user document
    2. Extracts interview DocumentReferences from the `interviews` map
    3. Fetches each interview using the reference's `.get()` method
    4. Returns sorted list (newest first)
  - **Benefit**: Shows ALL interviews associated with a user (both created and taken)
  - **Advantage of References**: Direct access to documents without string manipulation

- **Updated function**: `createFeedback()`
  - Now calls `addInterviewToUserMap()` after saving feedback
  - Ensures taken interviews are added to user's map

#### `app/api/vapi/generate/route.ts`
- **What changed**: After creating an interview, adds the interview DocumentReference to the user's map
- **When**: When a user generates a new interview via the Vapi assistant
- **How**: Updates the user document with `interviews.{interviewId}: DocumentReference`
- **Why References**: Provides direct linkage to the interview document in Firebase

### 3. Dashboard Behavior

#### "Your Interviews" Section
- **What it shows**: ALL interviews associated with the logged-in user
- **Includes**:
  - Interviews they created (generated)
  - Interviews they took (completed feedback for)
- **How**: Fetches interview IDs from user's `interviews` map

#### "Take Interviews" Section  
- **What it shows**: Latest 6 interviews created by other users
- **Excludes**: Interviews created by the current user
- **No change**: Still uses `getLatestInterviews()` with `limit: 6`

## Flow Diagrams

### Creating an Interview
```
User clicks "Create Interview" 
    ↓
Fills out form (role, type, techstack, etc.)
    ↓
Vapi assistant generates questions
    ↓
POST /api/vapi/generate
    ↓
1. Create interview document in "interviews" collection
2. Add interview ID to user's "interviews" map
    ↓
Interview appears in "Your Interviews" section
```

### Taking an Interview
```
User clicks "Take Interview" on an interview card
    ↓
Completes the interview
    ↓
System generates feedback
    ↓
createFeedback() function
    ↓
1. Save feedback to "feedback" collection
2. Add interview ID to user's "interviews" map
    ↓
Interview now appears in "Your Interviews" section
```

## Benefits

1. **Performance**: Direct reference lookup instead of querying entire collection
2. **Referential Integrity**: Using DocumentReferences maintains strong links to interview documents
3. **Accuracy**: User sees exactly which interviews they've interacted with
4. **Type Safety**: Firebase handles reference validation automatically
5. **Flexibility**: Easy to add metadata alongside references if needed
6. **No Duplicate Index Needed**: No composite index required for Firestore
7. **Cleaner Queries**: References can be dereferenced directly without path construction

## Migration Notes

### For Existing Users
Existing users will have their `interviews` map initialized as an empty object `{}` when they next sign in (via the webhook update logic).

To backfill existing data, you would need to run a migration script that:
1. Queries all interviews where `userId` matches
2. Adds those interview IDs to the user's `interviews` map
3. Queries all feedback where `userId` matches
4. Adds those interview IDs to the user's `interviews` map

### Example Migration Script (pseudo-code)
```javascript
// For each user in users collection
const users = await db.collection('users').get();
for (const userDoc of users.docs) {
  const userId = userDoc.id;
  const interviewsMap = {};
  
  // Get all interviews created by user
  const createdInterviews = await db.collection('interviews')
    .where('userId', '==', userId).get();
  
  createdInterviews.forEach(doc => {
    // Store DocumentReference instead of boolean
    interviewsMap[doc.id] = doc.ref;
  });
  
  // Get all interviews taken by user (via feedback)
  const feedbacks = await db.collection('feedback')
    .where('userId', '==', userId).get();
  
  for (const feedbackDoc of feedbacks.docs) {
    const interviewId = feedbackDoc.data().interviewId;
    // Create reference to interview document
    interviewsMap[interviewId] = db.collection('interviews').doc(interviewId);
  }
  
  // Update user document
  await db.collection('users').doc(userId).update({
    interviews: interviewsMap
  });
}
```

## Testing Checklist

- [ ] New user signs up → `interviews` map is initialized
- [ ] User creates interview → Interview ID added to map
- [ ] User takes interview → Interview ID added to map
- [ ] "Your Interviews" section shows all user's interviews
- [ ] "Take Interviews" section shows other users' interviews
- [ ] Both created and taken interviews appear in "Your Interviews"
