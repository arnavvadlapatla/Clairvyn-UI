# Clairvyn - AI Architecture Assistant

A modern React + TailwindCSS application featuring a chatbot designed to help architecture students with floor plan design and CAD projects.

## Features

### Landing Page (`/`)
- **Clairvyn Branding**: Clean, modern design with architectural grid background
- **Hero Section**: Large company name with descriptive tagline
- **Call-to-Action**: "Try It" button that redirects to sign-in or chat based on authentication
- **Features Section**: Three interactive cards showcasing key capabilities
- **Footer**: Organized quicklinks and social media connections

### Sign In Page (`/signin`)
- **Authentication**: Email/password, Google, and GitHub login options
- **Form Validation**: Real-time validation and error handling
- **Social Login**: One-click authentication with Google and GitHub
- **Toggle Mode**: Switch between sign-in and sign-up seamlessly
- **Responsive Design**: Works perfectly on all devices

### Chatbot Page (`/chatbot`) - Protected Route
- **Dual Access**: Available to both authenticated users and guest users
- **Guest Mode**: Immediate access without login, chats stored in localStorage
- **Guest Banner**: Dismissible banner prompting users to sign in
- **Header**: Dashboard icon, company name, and user/guest info with sign-out
- **Sidebar Navigation**: New Design (creates new chat), Search, Saved, History
- **Chat Interface**: Real-time messaging with Firestore (users) or localStorage (guests)
- **AI Simulation**: Intelligent responses based on user input
- **Loading States**: Smooth loading indicators and animations
- **Session Management**: Persistent login across page refreshes
- **Chat Migration**: Guest chats migrate to user account on sign-in

## Tech Stack

- **Framework**: Next.js 14 with React 18
- **Styling**: TailwindCSS with custom architectural grid backgrounds
- **Animations**: Framer Motion for smooth transitions and hover effects
- **Icons**: Lucide React for consistent iconography
- **UI Components**: Custom components built with Radix UI primitives

## Getting Started

1. **Install Dependencies**:
   ```bash
   npm install --legacy-peer-deps
   ```

2. **Run Development Server**:
   ```bash
   npm run dev
   ```

3. **Open Browser**:
   Navigate to `http://localhost:3000`

## Design Aesthetic

The application follows the ENARC app aesthetic with:
- Grid-based background with faint dots/lines
- Clean modern UI with rounded corners
- Soft shadows and minimal typography
- Teal and green gradient color scheme
- Responsive design principles

## Pages

- **`/`** - Landing page with company introduction and features
- **`/signin`** - Authentication page with email/password and social login
- **`/chatbot`** - Main chatbot interface with sidebar navigation (accessible to users and guests)
- **`/signout`** - Handles logout for both authenticated users and guests

## Future Enhancements

- Integration with actual AI backend for architectural assistance
- User authentication and profile management
- Design saving and history functionality
- Real-time collaboration features
- CAD file import/export capabilities

## Development

The application is built with TypeScript and follows modern React patterns including:
- Functional components with hooks
- Client-side state management
- Responsive design principles
- Accessibility considerations
# CLAIRVYN-UI
