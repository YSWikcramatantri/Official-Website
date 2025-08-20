# Overview

This is a quiz management system built with React (frontend) and Express.js (backend). The application allows participants to register for and take timed quizzes, while providing administrators with a dashboard to manage questions, participants, and system settings. The system features a clean, modern UI built with shadcn/ui components and TailwindCSS, with real-time data management using React Query.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Library**: shadcn/ui components built on Radix UI primitives with TailwindCSS for styling
- **Routing**: Wouter for client-side routing with dedicated routes for home, quiz, and admin sections
- **State Management**: React Query (TanStack Query) for server state management and API interactions
- **Form Handling**: React Hook Form with Zod validation for type-safe form validation

## Backend Architecture
- **Framework**: Express.js with TypeScript running on Node.js
- **API Design**: RESTful API with endpoints for participant registration, quiz management, and admin operations
- **Storage Layer**: Abstracted storage interface (IStorage) with in-memory implementation for development
- **Database Schema**: Drizzle ORM with PostgreSQL schema definitions for participants, questions, quiz submissions, and system settings
- **Session Management**: Express sessions with PostgreSQL session store (connect-pg-simple)

## Data Storage Solutions
- **ORM**: Drizzle ORM for type-safe database operations
- **Database**: PostgreSQL with Neon Database serverless hosting
- **Schema Validation**: Zod schemas for runtime type validation integrated with Drizzle
- **Migrations**: Drizzle Kit for database migrations and schema management

## Authentication and Authorization
- **Admin Authentication**: Password-based authentication for admin access with session management
- **Participant Access**: Passcode-based system for quiz access without traditional user accounts
- **Route Protection**: Admin routes protected behind authentication middleware
- **Security**: Environment-based configuration for sensitive data like database URLs and admin passwords

## External Dependencies
- **Database Hosting**: Neon Database (@neondatabase/serverless) for PostgreSQL hosting
- **UI Components**: Radix UI primitives for accessible, unstyled components
- **Styling**: TailwindCSS with custom CSS variables for theming
- **Form Validation**: Zod for schema validation and React Hook Form for form management
- **Date Handling**: date-fns for date manipulation and formatting
- **Development Tools**: Replit-specific tooling for development environment integration
- **Build Tools**: Vite for frontend bundling and esbuild for backend compilation

The application follows a monorepo structure with shared TypeScript schemas between frontend and backend, ensuring type safety across the full stack. The architecture supports real-time quiz functionality with timer management and automated score calculation.