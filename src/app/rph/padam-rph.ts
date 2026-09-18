"use server";

import { revalidatePath } from "next/cache";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { bilanganSemuaRph, padamSemuaRph } from "@/lib/rph/save";
import { supabaseRuntimeConfig } from "@/lib/runtime-env";

export async function padamSemuaRekodRph() {
  await connection();
  const cfg = supabaseRuntimeConfig();
  if (!cfg.service || cfg.role !== "service_role") {
    redirect("/rph?padam=kunci");
  }

  let baki = -1;
  try {
    await padamSemuaRph(cfg);
    baki = await bilanganSemuaRph(cfg);
  } catch (error) {
    console.error("padam_rph_gagal", error instanceof Error ? error.message : error);
    redirect("/rph?padam=gagal");
  }

  revalidatePath("/rph");
  revalidatePath("/api/rph");
  if (baki > 0) redirect(`/rph?padam=baki&n=${baki}`);
  redirect("/rph?padam=ok");
}
