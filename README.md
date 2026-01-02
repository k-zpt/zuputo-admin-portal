# Admin Portal

A modern admin portal built with Next.js, React, TypeScript, and Tailwind CSS for back-office staff to configure and review system settings.

## Features

- **Google OAuth Login**: Secure authentication with Google accounts
- **Dark/Light Mode**: Toggle between dark and light themes
- **Sidebar Navigation**: Easy access to all admin sections
- **API Integration**: Full integration with Zuputo Engine API
- **Responsive Design**: Works on all screen sizes

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
# Create a .env.local file with the following variables:

# API Configuration
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_PAYMENT_LINK_BASE_URL=http://localhost:8001

# Google OAuth Configuration
# Get these from Google Cloud Console: https://console.cloud.google.com/
# 1. Create a new project or select an existing one
# 2. Enable Google+ API
# 3. Go to "Credentials" > "Create Credentials" > "OAuth client ID"
# 4. Select "Web application"
# 5. Add authorized redirect URI: http://localhost:8001/api/auth/callback/google (for development)
#    Note: The redirect URI must match exactly what NextAuth uses: {AUTH_URL}/api/auth/callback/google
# 6. For production, add: https://yourdomain.com/api/auth/callback/google
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# Optional: Restrict login to specific email domain (e.g., zuputo.com)
# Leave empty to allow any Google account
ALLOWED_DOMAIN=zuputo.com

# NextAuth Configuration
# REQUIRED: Generate a random secret for production: openssl rand -base64 32
# This is critical for security - do not leave empty!
AUTH_SECRET=your_auth_secret_here
# Optional: Set the base URL for authentication (defaults to current host)
AUTH_URL=http://localhost:8001
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:8001](http://localhost:8001) in your browser.

## Available Sections

- **Customers**: View, search, and notify customers
- **Service Requests**: Manage service requests (coming soon)
- **Messages**: Review messages (coming soon)
- **Countries**: List and create countries
- **Currencies**: List and create currencies
- **Forms**: Browse and search forms
- **Config**: Update system configuration and pricing
- **Transactions**: View transactions (coming soon)
- **Blog**: Manage blog content (coming soon)

## API Configuration

The admin portal connects to the Zuputo Engine API. By default, it uses `http://127.0.0.1:8000` for local development. You can configure this by setting the `NEXT_PUBLIC_API_BASE_URL` environment variable.

### Payment Link Base URL

Payment links are generated with a configurable base URL. By default, this is set to `http://localhost:8001` for local development. You can configure this by setting the `NEXT_PUBLIC_PAYMENT_LINK_BASE_URL` environment variable. The full payment link URL will be constructed as `${NEXT_PUBLIC_PAYMENT_LINK_BASE_URL}/adhoc-payments/{paymentToken}`.

### Implemented API Endpoints

- **Currencies**: List, Get by ID, Create
- **Countries**: List, Get by ID, Create
- **Customers**: List, Search, Notify
- **Forms**: List, Get by ID
- **Configs**: Get, Update
- **Payment Links**: Generate, Fetch, Update, Initiate Payment
- **Notifier**: Send Email

## Tech Stack

- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Styling
- **next-themes** - Dark mode support

## Project Structure

```
admin_portal/
├── app/                    # Next.js app router pages
│   ├── customers/         # Customer management
│   ├── countries/         # Country configuration
│   ├── currencies/        # Currency configuration
│   ├── forms/             # Form management
│   ├── config/            # System configuration
│   └── ...
├── components/             # React components
│   ├── AdminLayout.tsx    # Main layout wrapper
│   ├── Sidebar.tsx        # Navigation sidebar
│   ├── ThemeToggle.tsx    # Dark/light mode toggle
│   └── ThemeProvider.tsx  # Theme context provider
└── lib/                    # Utilities and API
    └── api/               # API client and services
        ├── client.ts      # HTTP client
        ├── config.ts      # API configuration
        ├── services.ts    # API service functions
        └── types.ts       # TypeScript types
```

## Building for Production

```bash
npm run build
npm start
```

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
