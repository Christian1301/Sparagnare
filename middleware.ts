import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // Aggiorna sia i cookie della request (cosi' il resto della
          // pipeline di questa stessa richiesta - Server Component /
          // Server Action - vede subito la sessione aggiornata) sia
          // quelli della response (cosi' il browser riceve il nuovo
          // Set-Cookie). Senza questo doppio aggiornamento, un refresh
          // del token fatto qui nel middleware puo' invalidare il
          // refresh token "sotto i piedi" della Server Action che segue
          // nella stessa richiesta, causando errori intermittenti come
          // "new row violates row-level security policy".
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isAppRoute = request.nextUrl.pathname.startsWith("/app");
  const isLoginRoute = request.nextUrl.pathname.startsWith("/login");

  if (isAppRoute && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isLoginRoute && user) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/app/:path*", "/login"],
};
