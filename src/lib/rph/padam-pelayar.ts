type JawapanPadam = { ok?: boolean; ralat?: string; bil?: number };

async function bacaJson(res: Response): Promise<JawapanPadam> {
  const teks = await res.text();
  try {
    return JSON.parse(teks) as JawapanPadam;
  } catch {
    return { ralat: teks.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160) };
  }
}

async function posPadam(url: string, body: unknown, signal: AbortSignal) {
  const res = await fetch(url, {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });
  const json = await bacaJson(res);
  if (res.ok && json.ok === true) return json.bil ?? 0;
  throw new Error(json.ralat || `Gagal memadam RPH (${res.status}).`);
}

export async function hantarPadamRph(ids: string[]) {
  const bersih = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (!bersih.length) throw new Error("Pilih sekurang-kurangnya satu rekod RPH.");
  const pengawal = new AbortController();
  const masa = window.setTimeout(() => pengawal.abort(), 25000);
  const laluan = ["/api/rph/padam", "/api/rph", ...bersih.slice(0, 1).map((id) => `/api/rph/${id}`)];
  try {
    let terakhir: Error | null = null;
    for (const url of laluan) {
      try {
        const body = url.startsWith("/api/rph/") && url !== "/api/rph/padam" && url !== "/api/rph"
          ? { id: bersih[0] }
          : { ids: bersih };
        return await posPadam(url, body, pengawal.signal);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw new Error("Padam RPH tamat masa. Sila cuba semula.");
        }
        terakhir = error instanceof Error ? error : new Error("Gagal memadam RPH.");
      }
    }
    throw terakhir ?? new Error("Gagal memadam RPH.");
  } finally {
    window.clearTimeout(masa);
  }
}
