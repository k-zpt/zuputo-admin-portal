import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// Get allowed domain from environment, default to empty (no restriction)
const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN;

// Whitelist of allowed user emails (case-insensitive)
const ALLOWED_USERS = [
  'kwame@zuputo.com',
  'jessie@zuputo.com',
  'nanaadwoa@zuputo.com',
].map(email => email.toLowerCase());

// Get environment variables with fallbacks
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const AUTH_SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

// Validate required environment variables at runtime
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error("ERROR: Google OAuth credentials are missing!");
  console.error("Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env.local file");
}

if (!AUTH_SECRET) {
  console.warn("WARNING: AUTH_SECRET is not set. Authentication may not work properly.");
  console.warn("Generate one using: openssl rand -base64 32");
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: GOOGLE_CLIENT_ID || "dummy-client-id",
      clientSecret: GOOGLE_CLIENT_SECRET || "dummy-client-secret",
    }),
  ],
  pages: {
    signIn: "/login",
  },
  secret: AUTH_SECRET,
  trustHost: true,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) {
        console.error('Access denied: No email provided');
        return false;
      }

      const userEmail = user.email.toLowerCase();
      
      // If ALLOWED_DOMAIN is set, restrict login to that domain
      if (ALLOWED_DOMAIN) {
        const emailDomain = userEmail.split('@')[1];
        if (emailDomain !== ALLOWED_DOMAIN) {
          console.error(`Access denied: ${userEmail} is not from ${ALLOWED_DOMAIN}`);
          return false;
        }
      }
      
      // Check if user is in the whitelist
      if (!ALLOWED_USERS.includes(userEmail)) {
        console.error(`Access denied: ${userEmail} is not in the allowed users list`);
        return false;
      }
      
      return true;
    },
    async authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLoginPage = nextUrl.pathname.startsWith("/login");
      const isOnApiAuth = nextUrl.pathname.startsWith("/api/auth");
      
      // Allow API auth routes
      if (isOnApiAuth) {
        return true;
      }
      
      // If on login page and already logged in, check if they're allowed
      if (isOnLoginPage) {
        if (isLoggedIn) {
          // Check if user is in whitelist
          const userEmail = auth?.user?.email?.toLowerCase();
          if (userEmail && ALLOWED_USERS.includes(userEmail)) {
            return Response.redirect(new URL("/", nextUrl));
          } else {
            // User is logged in but not whitelisted, sign them out and show error
            return Response.redirect(new URL("/login?error=unauthorized", nextUrl));
          }
        }
        return true; // Allow access to login page if not logged in
      }
      
      // Protect all other routes
      if (!isLoggedIn) {
        return Response.redirect(new URL("/login", nextUrl));
      }
      
      // Check if logged-in user is in the whitelist
      const userEmail = auth?.user?.email?.toLowerCase();
      if (!userEmail || !ALLOWED_USERS.includes(userEmail)) {
        console.error(`Access denied: ${userEmail} is not in the allowed users list`);
        // Redirect to login with error message
        const loginUrl = new URL("/login", nextUrl);
        loginUrl.searchParams.set("error", "unauthorized");
        return Response.redirect(loginUrl);
      }
      
      return true;
    },
  },
});

