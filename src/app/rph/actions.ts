"use server";

import { connection } from "next/server";
import { revalidatePath } from "next/cache";
import { padamSemuaRph } from "@/lib/rph/save";

export async function padamRphSetahunAction() {
  await connection();
  try {
    const bil_rph = await padamSemuaRph();
    revalidatePath("/rph");
    revalidatePath("/api/rph");
    return { ok: true as const, bil_rph };
  } catch (error) {
    return {
      ok: false as const,
      ralat: error instanceof Error ? error.message : "Gagal memadam RPH.",
    };
  }
}
