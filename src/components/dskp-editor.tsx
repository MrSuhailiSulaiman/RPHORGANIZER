"use client";

import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { BidangPembelajaran, StandardKandungan, StandardPembelajaran } from "@/lib/dskp/types";

function bidangKosong(): BidangPembelajaran {
  return { kod: "", nama: "", penerangan: null, jam: null, standard_kandungan: [skKosong()] };
}

function skKosong(): StandardKandungan {
  return { kod: "", tajuk: "", standard_pembelajaran: [spKosong()] };
}

function spKosong(): StandardPembelajaran {
  return { kod: "", pernyataan: "", butiran: [] };
}

function kemaskiniBidang(
  senarai: BidangPembelajaran[],
  indeks: number,
  nilai: BidangPembelajaran
) {
  return senarai.map((item, i) => (i === indeks ? nilai : item));
}

export function DskpEditor({
  bidang,
  onChange,
}: {
  bidang: BidangPembelajaran[];
  onChange: (bidang: BidangPembelajaran[]) => void;
}) {
  return (
    <div className="space-y-4">
      {bidang.map((item, bidangIdx) => (
        <div key={`bidang-${bidangIdx}`} className="rounded-xl border bg-card">
          <div className="space-y-3 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Bidang pembelajaran
              </p>
              <div className="flex items-center gap-2">
                {item.standard_kandungan.length ? (
                  <Badge variant="outline">{item.standard_kandungan.length} SK</Badge>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onChange(bidang.filter((_, i) => i !== bidangIdx))}
                >
                  <Trash2 />
                  Padam bidang
                </Button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-[8rem_1fr_6rem]">
              <Input
                value={item.kod}
                onChange={(event) =>
                  onChange(kemaskiniBidang(bidang, bidangIdx, { ...item, kod: event.target.value }))
                }
                placeholder="1.0"
              />
              <Input
                value={item.nama}
                onChange={(event) =>
                  onChange(kemaskiniBidang(bidang, bidangIdx, { ...item, nama: event.target.value }))
                }
                placeholder="Nama bidang"
              />
              <Input
                type="number"
                min={0}
                value={item.jam ?? ""}
                onChange={(event) => {
                  const nombor = Number(event.target.value);
                  onChange(
                    kemaskiniBidang(bidang, bidangIdx, {
                      ...item,
                      jam: event.target.value && Number.isFinite(nombor) ? nombor : null,
                    })
                  );
                }}
                placeholder="Jam"
              />
            </div>
            <Input
              value={item.penerangan ?? ""}
              onChange={(event) =>
                onChange(
                  kemaskiniBidang(bidang, bidangIdx, {
                    ...item,
                    penerangan: event.target.value.trim() ? event.target.value : null,
                  })
                )
              }
              placeholder="Penerangan (pilihan)"
            />
          </div>
          <div className="border-t">
            {item.standard_kandungan.map((sk, skIdx) => (
              <div key={`sk-${bidangIdx}-${skIdx}`} className="space-y-3 border-b px-4 py-4 last:border-b-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Standard kandungan
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      onChange(
                        kemaskiniBidang(bidang, bidangIdx, {
                          ...item,
                          standard_kandungan: item.standard_kandungan.filter((_, i) => i !== skIdx),
                        })
                      )
                    }
                  >
                    <Trash2 />
                    Padam SK
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-[8rem_1fr]">
                  <Input
                    value={sk.kod}
                    onChange={(event) =>
                      onChange(
                        kemaskiniBidang(bidang, bidangIdx, {
                          ...item,
                          standard_kandungan: item.standard_kandungan.map((row, i) =>
                            i === skIdx ? { ...row, kod: event.target.value } : row
                          ),
                        })
                      )
                    }
                    placeholder="1.1"
                  />
                  <Input
                    value={sk.tajuk}
                    onChange={(event) =>
                      onChange(
                        kemaskiniBidang(bidang, bidangIdx, {
                          ...item,
                          standard_kandungan: item.standard_kandungan.map((row, i) =>
                            i === skIdx ? { ...row, tajuk: event.target.value } : row
                          ),
                        })
                      )
                    }
                    placeholder="Tajuk standard kandungan"
                  />
                </div>
                <div className="space-y-3">
                  {sk.standard_pembelajaran.map((sp, spIdx) => (
                    <div key={`sp-${bidangIdx}-${skIdx}-${spIdx}`} className="space-y-2 rounded-lg bg-muted/50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                          Standard pembelajaran
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            onChange(
                              kemaskiniBidang(bidang, bidangIdx, {
                                ...item,
                                standard_kandungan: item.standard_kandungan.map((row, i) =>
                                  i === skIdx
                                    ? {
                                        ...row,
                                        standard_pembelajaran: row.standard_pembelajaran.filter((_, j) => j !== spIdx),
                                      }
                                    : row
                                ),
                              })
                            )
                          }
                        >
                          <Trash2 />
                          Padam SP
                        </Button>
                      </div>
                      <Input
                        value={sp.kod}
                        onChange={(event) =>
                          onChange(
                            kemaskiniBidang(bidang, bidangIdx, {
                              ...item,
                              standard_kandungan: item.standard_kandungan.map((row, i) =>
                                i === skIdx
                                  ? {
                                      ...row,
                                      standard_pembelajaran: row.standard_pembelajaran.map((baris, j) =>
                                        j === spIdx ? { ...baris, kod: event.target.value } : baris
                                      ),
                                    }
                                  : row
                              ),
                            })
                          )
                        }
                        placeholder="1.1.1"
                      />
                      <Textarea
                        value={sp.pernyataan}
                        onChange={(event) =>
                          onChange(
                            kemaskiniBidang(bidang, bidangIdx, {
                              ...item,
                              standard_kandungan: item.standard_kandungan.map((row, i) =>
                                i === skIdx
                                  ? {
                                      ...row,
                                      standard_pembelajaran: row.standard_pembelajaran.map((baris, j) =>
                                        j === spIdx ? { ...baris, pernyataan: event.target.value } : baris
                                      ),
                                    }
                                  : row
                              ),
                            })
                          )
                        }
                        placeholder="Ayat standard pembelajaran"
                      />
                      <Textarea
                        value={sp.butiran.join("\n")}
                        onChange={(event) =>
                          onChange(
                            kemaskiniBidang(bidang, bidangIdx, {
                              ...item,
                              standard_kandungan: item.standard_kandungan.map((row, i) =>
                                i === skIdx
                                  ? {
                                      ...row,
                                      standard_pembelajaran: row.standard_pembelajaran.map((baris, j) =>
                                        j === spIdx
                                          ? {
                                              ...baris,
                                              butiran: event.target.value
                                                .split("\n")
                                                .map((nilai) => nilai.trim())
                                                .filter(Boolean),
                                            }
                                          : baris
                                      ),
                                    }
                                  : row
                              ),
                            })
                          )
                        }
                        placeholder="Butiran (i), (ii) — satu baris satu item (pilihan)"
                      />
                    </div>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      onChange(
                        kemaskiniBidang(bidang, bidangIdx, {
                          ...item,
                          standard_kandungan: item.standard_kandungan.map((row, i) =>
                            i === skIdx
                              ? { ...row, standard_pembelajaran: [...row.standard_pembelajaran, spKosong()] }
                              : row
                          ),
                        })
                      )
                    }
                  >
                    <Plus />
                    Tambah SP
                  </Button>
                </div>
              </div>
            ))}
            <div className="px-4 py-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  onChange(
                    kemaskiniBidang(bidang, bidangIdx, {
                      ...item,
                      standard_kandungan: [...item.standard_kandungan, skKosong()],
                    })
                  )
                }
              >
                <Plus />
                Tambah SK
              </Button>
            </div>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" onClick={() => onChange([...bidang, bidangKosong()])}>
        <Plus />
        Tambah bidang
      </Button>
    </div>
  );
}
