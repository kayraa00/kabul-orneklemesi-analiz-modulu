import * as XLSX from "xlsx";

interface ExportParams {
  distType: string;
  lotSize: number;
  aql: number;
  alpha: number;
  ltpd: number;
  beta: number;
}

interface ExportResults {
  n: number;
  c: number;
  aoql: number;
  paAql: number;
  paLtpd: number;
  chartData: Array<{ p: number; pa: number; aoq: number; ati: number }>;
}

interface CompareItem {
  distType: string;
  n: number;
  c: number;
  aoql: number;
  paAql: number;
  paLtpd: number;
  params: { lotSize: number; aql: number; ltpd: number };
}

export function exportToExcel(params: ExportParams, results: ExportResults, compareItems?: CompareItem[]) {
  const wb = XLSX.utils.book_new();

  const distNames: Record<string, string> = {
    poisson: "Poisson Dağılımı",
    binomial: "Binom Dağılımı",
    hypergeometric: "Hipergeometrik Dağılım",
  };

  // ── Sheet 1: Plan Özeti ──────────────────────────────────────────────────
  const summaryData = [
    ["KABUL ÖRNEKLEMESİ ANALİZ RAPORU"],
    ["MIL-STD-105E / Minitab Standartları"],
    [""],
    ["GİRDİ PARAMETRELERİ", ""],
    ["Dağılım Modeli", distNames[params.distType] ?? params.distType],
    ["Parti Hacmi (N)", params.lotSize],
    ["Hedeflenen AQL", params.aql],
    ["Üretici Riski (α)", params.alpha],
    ["Hedeflenen LTPD", params.ltpd],
    ["Tüketici Riski (β)", params.beta],
    [""],
    ["OPTİMUM PLAN METRİKLERİ", ""],
    ["Örneklem Büyüklüğü (n)", results.n],
    ["Kabul Sayısı (c)", results.c],
    ["AOQL — Maks Çıkan Kusur Oranı", `%${(results.aoql * 100).toFixed(4)}`],
    ["Pa(AQL) — AQL'de Kabul Olasılığı", `%${(results.paAql * 100).toFixed(2)}`],
    ["Pa(LTPD) — LTPD'de Kabul Olasılığı", `%${(results.paLtpd * 100).toFixed(2)}`],
    [""],
    ["ANALİZ RAPORU"],
    [""],
    ["AQL (Kabul Edilebilir Kalite Seviyesi)"],
    [
      `Gelen partinin kusur oranı %${(params.aql * 100).toFixed(1)} veya altındaysa, bu plan ürünü ` +
      `%${(results.paAql * 100).toFixed(1)} olasılıkla kabul eder. Bu, üreticinin kaliteli partilerinin ` +
      `büyük çoğunluğunun geçeceğini garanti eder (üretici riski α = %${(params.alpha * 100).toFixed(0)}).`,
    ],
    [""],
    ["LTPD (Tolere Edilemez Kusur Seviyesi)"],
    [
      `Gelen partinin kusur oranı %${(params.ltpd * 100).toFixed(1)}'e ulaştığında, bu plan ürünü yalnızca ` +
      `%${(results.paLtpd * 100).toFixed(1)} olasılıkla kabul eder. Kötü kaliteli partilerin müşteriye ` +
      `geçme riski tüketici riski β = %${(params.beta * 100).toFixed(0)} ile sınırlı tutulur.`,
    ],
    [""],
    ["AOQL (Ortalama Çıkan Kalite Sınırı)"],
    [
      `Bu (${results.n}, ${results.c}) örnekleme planı ve %100 ayıklama şartıyla, müşteriye ulaşacak ` +
      `ürünlerin içindeki ortalama kusur oranı hiçbir zaman %${(results.aoql * 100).toFixed(2)} seviyesini aşamaz.`,
    ],
    [""],
    ["ATI (Ortalama Toplam Muayene)"],
    [
      `AQL seviyesinde (%${(params.aql * 100).toFixed(1)}) gelen bir parti için ortalama ` +
      `${Math.round(results.n * results.paAql + params.lotSize * (1 - results.paAql)).toLocaleString()} adet muayene yapılır. ` +
      `LTPD seviyesinde (%${(params.ltpd * 100).toFixed(1)}) ise bu sayı ` +
      `${Math.round(results.n * results.paLtpd + params.lotSize * (1 - results.paLtpd)).toLocaleString()} adede yükselir. ` +
      `Parti kalitesi düştükçe reddedilen lotlara %100 muayene uygulandığından, en kötü senaryoda tüm N=${params.lotSize.toLocaleString()} adet kontrol edilir.`,
    ],
  ];

  const wsSum = XLSX.utils.aoa_to_sheet(summaryData);
  wsSum["!cols"] = [{ wch: 40 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsSum, "Plan Özeti");

  // ── Sheet 2: OC Eğrisi ──────────────────────────────────────────────────
  const ocHeader = [["Giren Kusur Oranı (p)", "Giren Kusur Oranı (%)", "Kabul Olasılığı Pa(p)", "Kabul Olasılığı (%)"]];
  const ocRows = results.chartData.map((d) => [
    d.p,
    parseFloat((d.p * 100).toFixed(4)),
    d.pa,
    parseFloat((d.pa * 100).toFixed(4)),
  ]);
  const wsOC = XLSX.utils.aoa_to_sheet([...ocHeader, ...ocRows]);
  wsOC["!cols"] = [{ wch: 26 }, { wch: 22 }, { wch: 26 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsOC, "OC Eğrisi");

  // ── Sheet 3: AOQ Eğrisi ─────────────────────────────────────────────────
  const aoqHeader = [["Giren Kusur Oranı (p)", "Giren Kusur Oranı (%)", "Ortalama Çıkan Kalite AOQ", "AOQ (%)"]];
  const aoqRows = results.chartData.map((d) => [
    d.p,
    parseFloat((d.p * 100).toFixed(4)),
    d.aoq,
    parseFloat((d.aoq * 100).toFixed(4)),
  ]);
  const wsAOQ = XLSX.utils.aoa_to_sheet([...aoqHeader, ...aoqRows]);
  wsAOQ["!cols"] = [{ wch: 26 }, { wch: 22 }, { wch: 28 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsAOQ, "AOQ Eğrisi");

  // ── Sheet 4: ATI Eğrisi ─────────────────────────────────────────────────
  const atiHeader = [["Giren Kusur Oranı (p)", "Giren Kusur Oranı (%)", "Ortalama Toplam Muayene (ATI)"]];
  const atiRows = results.chartData.map((d) => [
    d.p,
    parseFloat((d.p * 100).toFixed(4)),
    Math.round(d.ati),
  ]);
  const wsATI = XLSX.utils.aoa_to_sheet([...atiHeader, ...atiRows]);
  wsATI["!cols"] = [{ wch: 26 }, { wch: 22 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsATI, "ATI Eğrisi");

  // ── Sheet 5: Plan Karşılaştırması (opsiyonel) ───────────────────────────
  if (compareItems && compareItems.length >= 2) {
    const cmpHeader = [[
      "Plan (n,c)", "Dağılım", "N", "n", "c",
      "AQL (%)", "LTPD (%)", "Pa(AQL) (%)", "Pa(LTPD) (%)",
      "AOQL (%)", "ATI@AQL (adet)", "ATI@LTPD (adet)",
    ]];
    const cmpRows = compareItems.map((e) => {
      const atiAql  = Math.round(e.n * e.paAql  + e.params.lotSize * (1 - e.paAql));
      const atiLtpd = Math.round(e.n * e.paLtpd + e.params.lotSize * (1 - e.paLtpd));
      return [
        `(${e.n}, ${e.c})`,
        distNames[e.distType] ?? e.distType,
        e.params.lotSize,
        e.n,
        e.c,
        parseFloat((e.params.aql  * 100).toFixed(2)),
        parseFloat((e.params.ltpd * 100).toFixed(2)),
        parseFloat((e.paAql  * 100).toFixed(2)),
        parseFloat((e.paLtpd * 100).toFixed(2)),
        parseFloat((e.aoql   * 100).toFixed(4)),
        atiAql,
        atiLtpd,
      ];
    });
    const wsCmp = XLSX.utils.aoa_to_sheet([...cmpHeader, ...cmpRows]);
    wsCmp["!cols"] = [
      { wch: 12 }, { wch: 22 }, { wch: 10 }, { wch: 6 }, { wch: 6 },
      { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 14 },
      { wch: 10 }, { wch: 16 }, { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, wsCmp, "Plan Karşılaştırması");
  }

  // ── İndir ───────────────────────────────────────────────────────────────
  const timestamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `kabul-orneklemesi-${timestamp}.xlsx`);
}
