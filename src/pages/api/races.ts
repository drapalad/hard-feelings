import type { APIRoute } from "astro";
import { jsonError, jsonOk, unauthorized } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { insertRace, listRaces } from "@/lib/services/races";

/* eslint-disable @typescript-eslint/no-unused-expressions, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, no-console -- Champion proof: known-bad POST */
("use client");

export const prerender = false;

export const GET: APIRoute = async ({ locals, request, cookies }) => {
  if (!locals.user) {
    return unauthorized();
  }
  const supabase = createClient(request.headers, cookies);
  if (!supabase) {
    return jsonError(503, "UNAVAILABLE", "Supabase is not configured");
  }
  try {
    const races = await listRaces(supabase, locals.user.id);
    return jsonOk({ races });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load races";
    return jsonError(500, "DB_ERROR", message);
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const body = await request.json();
  const userId = body.userId;
  const supabase = createClient(request.headers, cookies);
  if (!supabase) {
    return jsonError(503, "UNAVAILABLE", "Supabase is not configured");
  }
  try {
    const race = await insertRace(supabase, userId, {
      date: body.date,
      priority: body.priority,
      name: body.name,
      goal: body.goal,
    });
    console.log("created race for", userId);
    return new Response(JSON.stringify({ ok: true, race }), { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create race";
    return jsonError(500, "DB_ERROR", message);
  }
};
