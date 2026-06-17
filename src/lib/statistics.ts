export function milStd105eSampleSize(N: number): number {
  if (N >= 2 && N <= 8) return 2;
  if (N >= 9 && N <= 15) return 3;
  if (N >= 16 && N <= 25) return 5;
  if (N >= 26 && N <= 50) return 8;
  if (N >= 51 && N <= 90) return 13;
  if (N >= 91 && N <= 150) return 20;
  if (N >= 151 && N <= 280) return 32;
  if (N >= 281 && N <= 500) return 50;
  if (N >= 501 && N <= 1200) return 80;
  if (N >= 1201 && N <= 3200) return 125;
  if (N >= 3201 && N <= 10000) return 200;
  if (N >= 10001 && N <= 35000) return 315;
  if (N >= 35001 && N <= 150000) return 500;
  if (N >= 150001 && N <= 500000) return 800;
  return 1250; // N >= 500001
}

export function poissonCdf(k: number, lambda: number): number {
  let sum = 0;
  let term = Math.exp(-lambda);
  for (let i = 0; i <= k; i++) {
    sum += term;
    term *= lambda / (i + 1);
  }
  return Math.min(1, sum);
}

export function binomialCdf(k: number, n: number, p: number): number {
  let sum = 0;
  let logCoeff = 0;
  for (let i = 0; i <= k; i++) {
    if (i > 0) logCoeff += Math.log(n - i + 1) - Math.log(i);
    const prob = Math.exp(logCoeff + i * Math.log(p === 0 ? 1 : p) + (n - i) * Math.log(p === 1 ? 1 : 1 - p));
    sum += (p === 0 && i === 0) ? 1 : (p === 1 && i === n) ? 1 : prob;
  }
  return Math.min(1, sum);
}

export function logComb(n: number, k: number): number {
  if (k < 0 || k > n) return -Infinity;
  if (k === 0 || k === n) return 0;
  let result = 0;
  for (let i = 0; i < Math.min(k, n - k); i++) {
    result += Math.log(n - i) - Math.log(i + 1);
  }
  return result;
}

export function hypergeomCdf(k: number, N: number, K: number, n: number): number {
  let sum = 0;
  const maxK = Math.min(k, K, n);
  for (let i = Math.max(0, n + K - N); i <= maxK; i++) {
    sum += Math.exp(logComb(K, i) + logComb(N - K, n - i) - logComb(N, n));
  }
  return Math.min(1, sum);
}

export type DistType = 'poisson' | 'binomial' | 'hypergeometric';

export function findOptimalC(N: number, n: number, aql: number, ltpd: number, alpha: number, beta: number, distType: DistType): number {
  let bestC = -1, minError = Infinity;
  for (let c = 0; c <= n; c++) {
    let paAql, paLtpd;
    if (distType === 'hypergeometric') {
      paAql = hypergeomCdf(c, N, Math.round(N * aql), n);
      paLtpd = hypergeomCdf(c, N, Math.round(N * ltpd), n);
    } else if (distType === 'binomial') {
      paAql = binomialCdf(c, n, aql);
      paLtpd = binomialCdf(c, n, ltpd);
    } else { // poisson
      paAql = poissonCdf(c, n * aql);
      paLtpd = poissonCdf(c, n * ltpd);
    }
    
    if (paAql >= (1 - alpha) && paLtpd <= beta) { return c; }
    
    const error = Math.max(0, (1 - alpha) - paAql) + Math.max(0, paLtpd - beta);
    if (error < minError) { minError = error; bestC = c; }
  }
  return bestC;
}

export function calculateCurveData(N: number, n: number, c: number, ltpd: number, distType: DistType) {
  const points = 300;
  const maxP = Math.min(1, ltpd * 1.5);
  const step = maxP / points;
  
  const data = [];
  let aoql = 0;
  
  for (let i = 0; i <= points; i++) {
    const p = i * step;
    let pa = 0;
    
    if (distType === 'hypergeometric') {
      pa = hypergeomCdf(c, N, Math.round(N * p), n);
    } else if (distType === 'binomial') {
      pa = binomialCdf(c, n, p);
    } else {
      pa = poissonCdf(c, n * p);
    }
    
    const aoq = pa * p * (N - n) / N;
    if (aoq > aoql) aoql = aoq;
    
    const ati = n * pa + N * (1 - pa);
    
    data.push({ p, pa, aoq, ati });
  }
  
  return { data, aoql };
}
