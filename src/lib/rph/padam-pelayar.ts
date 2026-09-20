type JawapanPadam = { ok?: boolean; ralat?: string; bil?: number; bil_rph?: number };

async function bacaJson(res: Response): Promise<JawapanPadam> {
  const teks = await res.text();
  try {
    return JSON.parse(teks) as JawapanPadam;
  } catch {
    return { ralat: teks.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160) };
  }
}

async function posPadam(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    keepalive: true,
    headers: {
      Accept: "application/json",
      ...(body != null ? { "Content-Type": "application/json" } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const json = await bacaJson(res);
  if (!res.ok) throw new Error(json.ralat || `Gagal memadam RPH (${res.status}).`);
  return json;
}

export async function hantarPadamSemuaRph() {
  const json = await posPadam("/api/rph/tahun");
  return json.bil_rph ?? json.bil ?? 0;
}

export async function hantarPadamRph(ids: string[]) {
  const bersih = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (!bersih.length) throw new Error("Pilih sekurang-kurangnya satu rekod RPH.");
  const laluan = ["/api/rph/padam", "/api/rph", ...bersih.slice(0, 1).map((id) => `/api/rph/${id}`)];
  let terakhir: Error | null = null;
  for (const url of laluan) {
    try {
      const body =
        url.startsWith("/api/rph/") && url !== "/api/rph/padam" && url !== "/api/rph"
          ? { id: bersih[0] }
          : { ids: bersih };
      const json = await posPadam(url, body);
      if (json.ok === true || json.bil != null || json.bil_rph != null) {
        return json.bil ?? json.bil_rph ?? bersih.length;
      }
      throw new Error(json.ralat || "Gagal memadam RPH.");
    } catch (error) {
      terakhir = error instanceof Error ? error : new Error("Gagal memadam RPH.");
    }
  }
  throw terakhir ?? new Error("Gagal memadam RPH.");
}
