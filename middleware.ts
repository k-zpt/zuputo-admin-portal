import { auth } from "@/lib/auth";

export default auth((req) => {
  // The auth callback in lib/auth.ts handles all authentication checks and redirects
  // This middleware just ensures the auth callback is called for all matching routes
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /api/* and /api (NextAuth + Next.js API proxy — must not run page auth on fetches)
     * - /_next* (static chunks, CSS, RSC, HMR). Use _next prefix (not only _next/) so /_next
     *   does not hit auth and return HTML instead of assets (broken layout / hydration).
     * - /__nextjs* (Next.js dev overlay)
     * - favicon and common static file extensions
     * Use api/ not "api" so paths like /apiculture are not accidentally excluded.
     */
    "/((?!api/|api$|_next|__nextjs|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

