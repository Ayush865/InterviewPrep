# System Architecture

## Overview
HiredFox is a Next.js-based application that provides AI-powered mock interviews. It leverages various modern technologies to deliver a seamless, interactive experience.

## Tech Stack & Components

### Frontend
- **Framework:** [Next.js](https://nextjs.org/) (App Router)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **UI Components:** [shadcn/ui](https://ui.shadcn.com/)
- **Icons:** Lucide React

### Backend
- **API:** Next.js API Routes / Server Actions
- **Database:** MySQL (via Drizzle ORM)
- **Authentication:** [Clerk](https://clerk.com/)
    - Middleware handles session verification.
    - Webhooks sync user data to the database.

### AI Integration
- **Voice AI:** [Vapi](https://vapi.ai/)
    - Handles real-time voice interaction for interviews.
    - Server SDK for management, Web SDK for client-side interaction.
- **Generative AI:** [Google Gemini](https://deepmind.google/technologies/gemini/)
    - Generates interview questions and feedback.

### Deployment
- **Platform:** [Vercel](https://vercel.com/)
- **Environment:** Node.js runtime

## Core Flows

### 1. User Authentication
1. User signs up/in via Clerk.
2. Clerk Webhook triggers `/api/webhooks/clerk`.
3. User data is synced to the primary database (ensuring local user record exists).

### 2. Interview Creation
1. User defines job role, tech stack, and experience level.
2. Google Gemini generates specific interview questions.
3. Interview session is initialized and stored in the database.

### 3. Interview Process
1. User enters the interview room (`/interview/[id]/start`).
2. Vapi Web SDK initializes voice agent.
3. User speaks with the AI agent.
4. Conversation is transcribed and processed in real-time.

### 4. Feedback Generation
1. Upon interview completion, the transcript is sent to Google Gemini.
2. AI analyzes responses against expectations.
3. Detailed feedback (strengths, weaknesses, score) is generated and stored.
4. User views feedback on the dashboard.

## Directory Structure (Key Areas)
- `/app`: Next.js App Router pages and API routes.
- `/components`: Reusable UI components.
- `/lib`: Utility functions and shared logic.
- `/docs`: Project documentation and guides.
