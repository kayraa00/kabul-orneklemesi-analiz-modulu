# Kabul Örneklemesi Analiz Modülü

MIL-STD-105E standardına göre istatistiksel kabul örnekleme planı hesaplayan, OC / AOQ / ATI eğrilerini görselleştiren ve sonuçları Excel'e aktaran interaktif bir web uygulaması.

## Özellikler

- **Üç dağılım modeli** — Poisson, Binom ve Hipergeometrik
- **Optimal plan hesabı** — Verilen AQL, LTPD, α ve β değerleriyle minimum örneklem boyutu (n, c) bulunur
- **İnteraktif grafikler** — OC (İşletim Karakteristik), AOQ (Ortalama Çıkan Kalite), ATI (Ortalama Toplam Muayene) eğrileri
- **Detaylı analiz raporu** — AQL, LTPD, AOQL ve ATI yorumları
- **Plan geçmişi** — Son 10 hesaplama kaydedilir, tek tıkla yüklenir
- **Plan karşılaştırması** — Birden fazla planı yan yana karşılaştırma tablosu
- **Excel dışa aktarma** — 5 sayfalı rapor (Plan Özeti, OC, AOQ, ATI eğrileri, Karşılaştırma)
- **Açık/koyu tema** — Sistem temasını takip eder

## Kurulum

**Node.js 18+** gereklidir.

```bash
# Bağımlılıkları yükle
npm install

# Geliştirme sunucusunu başlat
npm run dev
```

Tarayıcıda `http://localhost:5173` adresini açın.

## Build (Üretim)

```bash
npm run build
# Çıktı: dist/ klasörü — herhangi bir statik sunucuya yüklenebilir
```

## Kullanım

1. Sol panelden **dağılım modeli** seçin (Poisson önerilir)
2. **Parti Hacmi (N)**, **AQL**, **LTPD**, **α** ve **β** değerlerini girin
3. **Hesapla** butonuna tıklayın
4. Sağ panelde OC, AOQ ve ATI eğrilerini ve analiz raporunu inceleyin
5. **Excel Olarak İndir** ile tam raporu indirin
6. Farklı parametrelerle hesaplama yapıp **Plan Geçmişi**'nde planları karşılaştırın

## Teknik Detaylar

| Katman | Teknoloji |
|--------|-----------|
| UI Framework | React 19 + Vite 7 |
| Stil | Tailwind CSS 4 + shadcn/ui bileşenleri |
| Grafikler | Recharts |
| Animasyonlar | Framer Motion |
| Form | React Hook Form + Zod |
| Excel | xlsx (SheetJS) |
| Dil | TypeScript |

Tüm istatistiksel hesaplamalar (`src/lib/statistics.ts`) harici kütüphane olmadan sıfırdan yazılmıştır.

## İstatistiksel Metodoloji

- **Poisson** — Küçük kusur oranları için (p < 0.1), büyük lot boyutlarında tercih edilir
- **Binom** — Genel amaçlı, teorik olarak en doğru model
- **Hipergeometrik** — Lot büyüklüğü örneklemle karşılaştırılabilir olduğunda (n/N > 0.1)

Plan optimizasyonu, belirtilen α ve β risk kısıtlarını karşılayan minimum (n, c) çiftini grid-search ile bulur.

## Lisans

MIT
