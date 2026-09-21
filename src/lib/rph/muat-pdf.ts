export async function muatTurunPdfMinggu(params: {
  ids: string[];
  minggu: number;
  tarikh_mula?: string | null;
  tarikh_tamat?: string | null;
  penggunaId?: string;
}) {
  const res = await fetch("/api/rph/pdf", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/pdf",
    },
    body: JSON.stringify({
      ids: params.ids,
      minggu: params.minggu,
      tarikh_mula: params.tarikh_mula ?? undefined,
      tarikh_tamat: params.tarikh_tamat ?? undefined,
      pengguna_id: params.penggunaId,
    }),
  });
  const jenis = res.headers.get("content-type") ?? "";
  if (!res.ok || !jenis.includes("pdf")) {
    const json = (await res.json().catch(() => ({}))) as { ralat?: string };
    throw new Error(json.ralat ?? "Gagal memuat turun PDF RPH.");
  }
  const blob = await res.blob();
  const nama =
    res.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ??
    `M${params.minggu} - PENGGUNA.pdf`;
  const url = URL.createObjectURL(blob);
  const pautan = document.createElement("a");
  pautan.href = url;
  pautan.download = nama;
  document.body.appendChild(pautan);
  pautan.click();
  pautan.remove();
  URL.revokeObjectURL(url);
}
