import React, { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot } from "recharts";
import { Moon, Sun, Calculator, Activity, Sigma, Target, FileSpreadsheet, History, X, ChevronRight, Columns2 } from "lucide-react";

import { useTheme } from "@/components/theme-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { milStd105eSampleSize, findOptimalC, calculateCurveData, DistType, poissonCdf, binomialCdf, hypergeomCdf } from "@/lib/statistics";
import { exportToExcel } from "@/lib/excel-export";

const formSchema = z.object({
  lotSize: z.coerce.number().int().positive({ message: "Parti hacmi pozitif bir tamsayı olmalıdır" }),
  aql: z.coerce.number().min(0.0001).max(0.9999, { message: "AQL 0 ile 1 arasında olmalıdır" }),
  alpha: z.coerce.number().min(0.001).max(0.999, { message: "Üretici riski (α) 0 ile 1 arasında olmalıdır" }),
  ltpd: z.coerce.number().min(0.0001).max(0.9999, { message: "LTPD 0 ile 1 arasında olmalıdır" }),
  beta: z.coerce.number().min(0.001).max(0.999, { message: "Tüketici riski (β) 0 ile 1 arasında olmalıdır" }),
}).refine(data => data.aql < data.ltpd, {
  message: "AQL, LTPD'den küçük olmalıdır",
  path: ["ltpd"],
});

type FormValues = z.infer<typeof formSchema>;

const DIST_LABELS: Record<string, string> = {
  poisson: "Poisson",
  binomial: "Binom",
  hypergeometric: "Hipergeometrik",
};

type ResultEntry = {
  id: number;
  distType: DistType;
  n: number;
  c: number;
  aoql: number;
  paAql: number;
  paLtpd: number;
  chartData: any[];
  params: FormValues;
  timestamp: Date;
};

export default function Home() {
  const { theme, setTheme } = useTheme();
  const [distType, setDistType] = useState<DistType>("poisson");
  const [history, setHistory] = useState<ResultEntry[]>([]);
  const [compareIds, setCompareIds] = useState<Set<number>>(new Set());

  const toggleCompare = (id: number) => {
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const [results, setResults] = useState<{
    n: number;
    c: number;
    aoql: number;
    paAql: number;
    paLtpd: number;
    chartData: any[];
    params: FormValues;
  } | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      lotSize: 10000,
      aql: 0.015,
      alpha: 0.05,
      ltpd: 0.06,
      beta: 0.10,
    },
  });

  const onSubmit = (data: FormValues) => {
    const n = milStd105eSampleSize(data.lotSize);
    const c = findOptimalC(data.lotSize, n, data.aql, data.ltpd, data.alpha, data.beta, distType);
    
    let paAql = 0, paLtpd = 0;
    if (distType === 'hypergeometric') {
      paAql = hypergeomCdf(c, data.lotSize, Math.round(data.lotSize * data.aql), n);
      paLtpd = hypergeomCdf(c, data.lotSize, Math.round(data.lotSize * data.ltpd), n);
    } else if (distType === 'binomial') {
      paAql = binomialCdf(c, n, data.aql);
      paLtpd = binomialCdf(c, n, data.ltpd);
    } else {
      paAql = poissonCdf(c, n * data.aql);
      paLtpd = poissonCdf(c, n * data.ltpd);
    }

    const { data: chartData, aoql } = calculateCurveData(data.lotSize, n, c, data.ltpd, distType);

    const entry: ResultEntry = {
      id: Date.now(),
      distType,
      n, c, aoql, paAql, paLtpd, chartData,
      params: data,
      timestamp: new Date(),
    };
    setResults({ n, c, aoql, paAql, paLtpd, chartData, params: data });
    setHistory((prev) => [entry, ...prev].slice(0, 10));
  };

  const loadFromHistory = (entry: ResultEntry) => {
    setDistType(entry.distType);
    form.reset(entry.params);
    setResults({
      n: entry.n,
      c: entry.c,
      aoql: entry.aoql,
      paAql: entry.paAql,
      paLtpd: entry.paLtpd,
      chartData: entry.chartData,
      params: entry.params,
    });
  };

  const handleExcelDownload = () => {
    if (!results) return;
    const compareItems = history.filter((h) => compareIds.has(h.id));
    exportToExcel(
      {
        distType,
        lotSize: results.params.lotSize,
        aql: results.params.aql,
        alpha: results.params.alpha,
        ltpd: results.params.ltpd,
        beta: results.params.beta,
      },
      results,
      compareItems.length >= 2 ? compareItems : undefined
    );
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-primary/20 selection:text-primary">
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
              <Activity className="size-5" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground tracking-tight">Kabul Örneklemesi Analiz Modülü</h1>
              <p className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                MIL-STD-105E
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="rounded-full"
          >
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Temayı değiştir</span>
          </Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 space-y-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: Controls */}
          <div className="lg:col-span-4 space-y-6">
            
            <Card className="shadow-sm border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="size-4 text-primary" />
                  Dağılım Modeli
                </CardTitle>
                <CardDescription>
                  Örneklem hesabı için kullanılacak istatistiksel modeli seçin.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: "poisson", label: "Poisson" },
                    { id: "binomial", label: "Binom" },
                    { id: "hypergeometric", label: "Hipergeometrik" },
                  ].map((model) => (
                    <button
                      key={model.id}
                      onClick={() => setDistType(model.id as DistType)}
                      className={`text-left px-4 py-3 rounded-md border transition-all ${
                        distType === model.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-border/50 hover:border-border hover:bg-secondary/50"
                      }`}
                    >
                      <div className="font-medium text-sm text-foreground">{model.label}</div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calculator className="size-4 text-primary" />
                  Parametreler
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="lotSize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Parti Hacmi (N)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} className="font-mono text-sm" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="aql"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Hedeflenen AQL</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.001" {...field} className="font-mono text-sm" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="alpha"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Üretici Riski (α)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.001" {...field} className="font-mono text-sm" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="ltpd"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Hedeflenen LTPD</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.001" {...field} className="font-mono text-sm" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="beta"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tüketici Riski (β)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.001" {...field} className="font-mono text-sm" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button type="submit" className="w-full mt-2 font-medium" size="lg">
                      <Sigma className="mr-2 size-4" />
                      Optimum Planı Hesapla
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Plan Geçmişi */}
            <AnimatePresence>
              {history.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.25 }}
                >
                  <Card className="shadow-sm border-border/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <History className="size-4 text-primary" />
                          Plan Geçmişi
                        </CardTitle>
                        <button
                          onClick={() => setHistory([])}
                          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                          data-testid="button-clear-history"
                        >
                          Temizle
                        </button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      {compareIds.size >= 1 && (
                        <div className="px-4 py-2 border-b border-border/40 bg-primary/5 flex items-center gap-2">
                          <Columns2 className="size-3.5 text-primary" />
                          <span className="text-xs text-primary font-medium">
                            {compareIds.size} plan seçili — Karşılaştırma tablosu aşağıdan görüntülenebilir
                          </span>
                        </div>
                      )}
                      <ul className="divide-y divide-border/40">
                        {history.map((entry) => {
                          const isSelected = compareIds.has(entry.id);
                          return (
                            <li key={entry.id} className={isSelected ? "bg-primary/5" : ""}>
                              <div className="flex items-center group">
                                <button
                                  onClick={() => toggleCompare(entry.id)}
                                  className={`shrink-0 ml-3 size-4 rounded border transition-all flex items-center justify-center ${
                                    isSelected
                                      ? "bg-primary border-primary"
                                      : "border-border hover:border-primary/50"
                                  }`}
                                  data-testid={`button-compare-${entry.id}`}
                                  title="Karşılaştırmaya ekle"
                                >
                                  {isSelected && (
                                    <svg className="size-2.5 text-primary-foreground" fill="none" viewBox="0 0 10 8">
                                      <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  )}
                                </button>
                                <button
                                  onClick={() => loadFromHistory(entry)}
                                  className="flex-1 flex items-center gap-3 px-3 py-3 hover:bg-muted/40 transition-colors text-left"
                                  data-testid={`button-history-${entry.id}`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="font-mono text-xs font-semibold text-primary">
                                        ({entry.n}, {entry.c})
                                      </span>
                                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                                        {DIST_LABELS[entry.distType]}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                                      <span>N={entry.params.lotSize.toLocaleString()}</span>
                                      <span>AQL={(entry.params.aql * 100).toFixed(1)}%</span>
                                      <span>AOQL={(entry.aoql * 100).toFixed(2)}%</span>
                                    </div>
                                  </div>
                                  <ChevronRight className="size-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
                                </button>
                                <button
                                  onClick={() => {
                                    setHistory((prev) => prev.filter((h) => h.id !== entry.id));
                                    setCompareIds((prev) => { const n = new Set(prev); n.delete(entry.id); return n; });
                                  }}
                                  className="shrink-0 mr-3 p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-all"
                                  data-testid={`button-delete-history-${entry.id}`}
                                >
                                  <X className="size-3" />
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

          </div>

          {/* RIGHT COLUMN: Results */}
          <div className="lg:col-span-8">
            <AnimatePresence mode="wait">
              {results ? (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <MetricCard title="Parti Hacmi" value={results.params.lotSize.toLocaleString()} label="N" />
                    <MetricCard title="Örneklem" value={results.n.toString()} label="n" highlight />
                    <MetricCard title="Kabul Sayısı" value={results.c.toString()} label="c" highlight />
                    <MetricCard title="AOQL" value={`${(results.aoql * 100).toFixed(2)}%`} label="Maks Kusur" />
                    <MetricCard title="Pa(AQL)" value={`${(results.paAql * 100).toFixed(1)}%`} label="Kabul Olasılığı" />
                    <MetricCard title="Pa(LTPD)" value={`${(results.paLtpd * 100).toFixed(1)}%`} label="Kabul Olasılığı" />
                  </div>

                  <Card className="shadow-sm border-border/50 overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b border-border/40 pb-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                        <div>
                          <CardTitle>Analiz Grafikleri</CardTitle>
                          <CardDescription>Performans karakteristik eğrileri</CardDescription>
                        </div>
                        <Badge variant="outline" className="font-mono bg-background">
                          Plan: ({results.n}, {results.c})
                        </Badge>
                      </div>
                    </CardHeader>
                    <Tabs defaultValue="oc" className="w-full">
                      <div className="px-6 pt-4">
                        <TabsList className="grid w-full grid-cols-3 h-10">
                          <TabsTrigger value="oc" className="text-xs sm:text-sm">OC Eğrisi</TabsTrigger>
                          <TabsTrigger value="aoq" className="text-xs sm:text-sm">AOQ Eğrisi</TabsTrigger>
                          <TabsTrigger value="ati" className="text-xs sm:text-sm">ATI Eğrisi</TabsTrigger>
                        </TabsList>
                      </div>
                      
                      <CardContent className="p-6 pt-6">
                        <TabsContent value="oc" className="m-0 h-[380px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={results.chartData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                              <XAxis 
                                dataKey="p" 
                                tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                tickMargin={10}
                                minTickGap={30}
                              />
                              <YAxis 
                                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                tickMargin={10}
                              />
                              <Tooltip 
                                formatter={(value: number) => [`${(value * 100).toFixed(2)}%`, 'Kabul Olasılığı Pa(p)']}
                                labelFormatter={(label: number) => `Kusur Oranı: ${(label * 100).toFixed(2)}%`}
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                              />
                              <ReferenceLine x={results.params.aql} stroke="hsl(var(--chart-2))" strokeDasharray="3 3" label={{ position: 'top', value: 'AQL', fill: 'hsl(var(--chart-2))', fontSize: 12 }} />
                              <ReferenceLine x={results.params.ltpd} stroke="hsl(var(--destructive))" strokeDasharray="3 3" label={{ position: 'top', value: 'LTPD', fill: 'hsl(var(--destructive))', fontSize: 12 }} />
                              
                              <ReferenceDot x={results.params.aql} y={results.paAql} r={5} fill="hsl(var(--chart-2))" stroke="none" />
                              <ReferenceDot x={results.params.ltpd} y={results.paLtpd} r={5} fill="hsl(var(--destructive))" stroke="none" />
                              
                              <Line type="monotone" dataKey="pa" stroke="hsl(var(--primary))" strokeWidth={3} dot={false} activeDot={{ r: 6 }} name="OC Eğrisi" />
                            </LineChart>
                          </ResponsiveContainer>
                        </TabsContent>
                        
                        <TabsContent value="aoq" className="m-0 h-[380px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={results.chartData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                              <XAxis 
                                dataKey="p" 
                                tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                tickMargin={10}
                              />
                              <YAxis 
                                tickFormatter={(v) => `${(v * 100).toFixed(2)}%`}
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                tickMargin={10}
                              />
                              <Tooltip 
                                formatter={(value: number) => [`${(value * 100).toFixed(3)}%`, 'Ortalama Çıkan Kalite (AOQ)']}
                                labelFormatter={(label: number) => `Giren Kusur Oranı: ${(label * 100).toFixed(2)}%`}
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                              />
                              <ReferenceLine y={results.aoql} stroke="hsl(var(--destructive))" strokeDasharray="3 3" label={{ position: 'right', value: 'AOQL', fill: 'hsl(var(--destructive))', fontSize: 12 }} />
                              <Line type="monotone" dataKey="aoq" stroke="hsl(var(--chart-4))" strokeWidth={3} dot={false} activeDot={{ r: 6 }} name="AOQ Eğrisi" />
                            </LineChart>
                          </ResponsiveContainer>
                        </TabsContent>
                        
                        <TabsContent value="ati" className="m-0 h-[380px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={results.chartData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                              <XAxis 
                                dataKey="p" 
                                tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                tickMargin={10}
                              />
                              <YAxis 
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                tickMargin={10}
                              />
                              <Tooltip 
                                formatter={(value: number) => [Math.round(value).toLocaleString(), 'Ortalama Toplam Muayene (ATI)']}
                                labelFormatter={(label: number) => `Kusur Oranı: ${(label * 100).toFixed(2)}%`}
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                              />
                              <Line type="monotone" dataKey="ati" stroke="hsl(var(--chart-5))" strokeWidth={3} dot={false} activeDot={{ r: 6 }} name="ATI Eğrisi" />
                            </LineChart>
                          </ResponsiveContainer>
                        </TabsContent>
                      </CardContent>
                    </Tabs>
                  </Card>

                  <Card className="bg-primary/5 border-primary/20 shadow-none">
                    <CardContent className="p-5 flex gap-4">
                      <div className="shrink-0 p-2 bg-primary/10 rounded-full h-fit">
                        <Activity className="size-5 text-primary" />
                      </div>
                      <div className="space-y-3">
                        <h4 className="font-semibold text-primary">Analiz Raporu</h4>

                        <p className="text-sm text-muted-foreground leading-relaxed">
                          <strong className="text-foreground">AQL (Kabul Edilebilir Kalite Seviyesi): %{(results.params.aql * 100).toFixed(1)}</strong> — Gelen partinin kusur oranı %{(results.params.aql * 100).toFixed(1)} veya altındaysa, bu plan ürünü <strong className="text-foreground">%{(results.paAql * 100).toFixed(1)}</strong> olasılıkla kabul eder. Bu, üreticinin kaliteli partilerinin büyük çoğunluğunun geçeceğini garanti eder (üretici riski α = %{(results.params.alpha * 100).toFixed(0)}).
                        </p>

                        <p className="text-sm text-muted-foreground leading-relaxed">
                          <strong className="text-foreground">LTPD (Tolere Edilemez Kusur Seviyesi): %{(results.params.ltpd * 100).toFixed(1)}</strong> — Gelen partinin kusur oranı %{(results.params.ltpd * 100).toFixed(1)}'e ulaştığında, bu plan ürünü yalnızca <strong className="text-foreground">%{(results.paLtpd * 100).toFixed(1)}</strong> olasılıkla kabul eder. Kötü kaliteli partilerin müşteriye geçme riski tüketici riski β = %{(results.params.beta * 100).toFixed(0)} ile sınırlı tutulur.
                        </p>

                        <p className="text-sm text-muted-foreground leading-relaxed">
                          <strong className="text-foreground">AOQL (Ortalama Çıkan Kalite Sınırı): %{(results.aoql * 100).toFixed(2)}</strong> — Bu <span className="font-mono text-primary">({results.n}, {results.c})</span> örnekleme planı ve %100 ayıklama şartıyla, müşteriye ulaşacak ürünlerin içindeki ortalama kusur oranı hiçbir zaman %{(results.aoql * 100).toFixed(2)} seviyesini aşamaz.
                        </p>

                        <p className="text-sm text-muted-foreground leading-relaxed">
                          <strong className="text-foreground">ATI (Ortalama Toplam Muayene)</strong> — AQL seviyesinde (%{(results.params.aql * 100).toFixed(1)}) gelen bir parti için ortalama <strong className="text-foreground">{Math.round(results.n * results.paAql + results.params.lotSize * (1 - results.paAql)).toLocaleString()}</strong> adet muayene yapılır. LTPD seviyesinde (%{(results.params.ltpd * 100).toFixed(1)}) ise bu sayı <strong className="text-foreground">{Math.round(results.n * results.paLtpd + results.params.lotSize * (1 - results.paLtpd)).toLocaleString()}</strong> adede yükselir. Parti kalitesi düştükçe reddedilen lotlara %100 muayene uygulandığından, en kötü senaryoda tüm N={results.params.lotSize.toLocaleString()} adet kontrol edilir.
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Excel İndir butonu */}
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      onClick={handleExcelDownload}
                      className="gap-2"
                    >
                      <FileSpreadsheet className="size-4" />
                      Excel Olarak İndir
                    </Button>
                  </div>

                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-border/60 rounded-xl bg-card/30"
                >
                  <div className="size-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                    <Target className="size-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">Henüz Analiz Yapılmadı</h3>
                  <p className="text-muted-foreground max-w-sm">
                    Sol taraftaki panelden parti hacmi ve hedef kalite seviyelerini belirleyerek optimum örneklem planını hesaplayabilirsiniz.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Karşılaştırma Tablosu */}
        <AnimatePresence>
          {compareIds.size >= 2 && (() => {
            const items = history.filter((h) => compareIds.has(h.id));
            return (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="shadow-sm border-border/50 overflow-hidden">
                  <CardHeader className="bg-muted/30 border-b border-border/40 pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Columns2 className="size-4 text-primary" />
                        <CardTitle className="text-base">Plan Karşılaştırması</CardTitle>
                        <Badge variant="outline" className="font-mono text-xs">{items.length} plan</Badge>
                      </div>
                      <button
                        onClick={() => setCompareIds(new Set())}
                        className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                      >
                        Seçimi Temizle
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/40 bg-muted/20">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Plan</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dağılım</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">N</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">n</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">c</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">AQL</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">LTPD</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pa(AQL)</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pa(LTPD)</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">AOQL</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">ATI@AQL</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">ATI@LTPD</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {items.map((e, idx) => {
                          const atiAql = Math.round(e.n * e.paAql + e.params.lotSize * (1 - e.paAql));
                          const atiLtpd = Math.round(e.n * e.paLtpd + e.params.lotSize * (1 - e.paLtpd));
                          return (
                            <tr key={e.id} className={idx % 2 === 0 ? "" : "bg-muted/10"}>
                              <td className="px-4 py-3 font-mono font-semibold text-primary">({e.n}, {e.c})</td>
                              <td className="px-4 py-3 text-muted-foreground text-xs">{DIST_LABELS[e.distType]}</td>
                              <td className="px-4 py-3 text-right font-mono text-xs">{e.params.lotSize.toLocaleString()}</td>
                              <td className="px-4 py-3 text-right font-mono font-semibold text-primary">{e.n}</td>
                              <td className="px-4 py-3 text-right font-mono font-semibold text-primary">{e.c}</td>
                              <td className="px-4 py-3 text-right font-mono text-xs">{(e.params.aql * 100).toFixed(1)}%</td>
                              <td className="px-4 py-3 text-right font-mono text-xs">{(e.params.ltpd * 100).toFixed(1)}%</td>
                              <td className="px-4 py-3 text-right font-mono text-xs text-green-600 dark:text-green-400">{(e.paAql * 100).toFixed(1)}%</td>
                              <td className="px-4 py-3 text-right font-mono text-xs text-destructive">{(e.paLtpd * 100).toFixed(1)}%</td>
                              <td className="px-4 py-3 text-right font-mono text-xs">{(e.aoql * 100).toFixed(2)}%</td>
                              <td className="px-4 py-3 text-right font-mono text-xs">{atiAql.toLocaleString()}</td>
                              <td className="px-4 py-3 text-right font-mono text-xs">{atiLtpd.toLocaleString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </main>

    </div>
  );
}

function MetricCard({ title, value, label, highlight = false }: { title: string; value: string; label: string; highlight?: boolean }) {
  return (
    <Card className={`shadow-sm border-border/50 overflow-hidden ${highlight ? 'ring-1 ring-primary/20 bg-primary/5' : ''}`}>
      <CardContent className="p-4">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">{title}</div>
        <div className={`text-2xl font-bold tracking-tight mb-1 font-mono ${highlight ? 'text-primary' : 'text-foreground'}`}>{value}</div>
        <div className="text-xs text-muted-foreground font-medium">{label}</div>
      </CardContent>
    </Card>
  );
}
