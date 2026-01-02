# Google OAuth Setup Guide

## Common Issues and Fixes

### Issue: "Server error - There is a problem with the server configuration"

This error typically occurs due to one of the following:

1. **Missing AUTH_SECRET** (Most Common)
   - NextAuth requires an `AUTH_SECRET` environment variable
   - Generate one using: `openssl rand -base64 32`
   - Add it to your `.env.local` file

2. **Redirect URI Mismatch**
   - Google Console redirect URI must match exactly what NextAuth uses
   - NextAuth uses: `http://localhost:8001/api/auth/callback/google`
   - **Important**: The redirect URI in Google Console must be: `{YOUR_PORT}/api/auth/callback/google`

3. **Environment Variables Not Loaded**
   - Make sure `.env.local` is in the root directory
   - Restart the dev server after adding environment variables

## Current Configuration

Based on your provided values:

```bash
GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxxxxxxxxx-xxxxxxxxxxxx
ALLOWED_DOMAIN=xxxxxxxxxxxx.com
```

## Required Steps

1. **Add AUTH_SECRET to `.env.local`**:
   ```bash
   AUTH_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
   ```
   (Or generate a new one: `openssl rand -base64 32`)

2. **Update Google Console Redirect URI**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to: APIs & Services > Credentials
   - Edit your OAuth 2.0 Client ID
   - Update "Authorized redirect URIs" to:
   - Default (port 8001): `http://localhost:8001/api/auth/callback/google`
   - **Remove** the old redirect URI: `http://localhost:8001/auth/callback`
   - **Add** the correct one: `http://localhost:8001/api/auth/callback/google`

3. **AUTH_URL is already set to port 8001** in `.env.local`

4. **Restart your dev server** after making these changes

## Complete .env.local Example

```bash
# API Configuration
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_PAYMENT_LINK_BASE_URL=http://localhost:8001

# Google OAuth Configuration
GOOGLE_CLIENT_ID=221611856308-vjnan4rjdcupnfr5el00494otoa2l251.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
ALLOWED_DOMAIN=zuputo.com

# NextAuth Configuration (REQUIRED)
AUTH_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
AUTH_URL=http://localhost:8001
```

## Testing

After making these changes:
1. Restart the dev server: `npm run dev`
2. Navigate to the login page
3. Click "Continue with Google"
4. You should be redirected to Google's login page
5. After logging in, you'll be redirected back to the admin portal

## Troubleshooting

- **Still getting server error?** Check the terminal/console for detailed error messages
- **Redirect URI error?** Make sure the URI in Google Console matches exactly (including `/api/auth/callback/google`)
- **Access denied?** Make sure you're using an email from `zuputo.com` domain (if ALLOWED_DOMAIN is set)

