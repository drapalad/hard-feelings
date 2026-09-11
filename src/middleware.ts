import { defineMiddleware } from "astro:middleware";
import { resolveAuthUser } from "@/lib/auth-user";
import { createClient } from "@/lib/supabase";
import { isAdminUser } from "@/lib/services/admin-role";

const PROTECTED_ROUTES = ["/dashboard", "/admin"];

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);
  context.locals.isAdmin = false;

  if (supabase) {
    context.locals.user = await resolveAuthUser(supabase);
    if (context.locals.user) {
      try {
        context.locals.isAdmin = await isAdminUser(supabase, context.locals.user.id);
      } catch {
        context.locals.isAdmin = false;
      }
    }
  } else {
    context.locals.user = null;
  }

  if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    if (!context.locals.user) {
      return context.redirect("/auth/signin");
    }
  }

  return next();
});
