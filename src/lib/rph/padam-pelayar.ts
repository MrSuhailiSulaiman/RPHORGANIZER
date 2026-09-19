export async function hantarPadamRph(ids: string[]) {
  const bersih = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (!bersih.length) throw new Error("Pilih sekurang-kurangnya satu rekod RPH.");
  const url = new URL("/api/rph/padam", window.location.origin);
  const res = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ ids: bersih }),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; ralat?: string; bil?: number };
  if (!res.ok || json.ok !== true) {
    throw new Error(json.ralat ?? "Gagal memadam RPH.");
  }
  return json.bil ?? bersih.length;
}
