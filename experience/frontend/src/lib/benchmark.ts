import type { Benchmark } from './types'

export function benchmarkPercent(benchmark: Benchmark) {
  if (benchmark.direction === 'max') {
    if (benchmark.score <= 0) return 0
    return Math.min(100, (benchmark.threshold / benchmark.score) * 100)
  }
  return Math.min(100, (benchmark.score / Math.max(benchmark.threshold, 0.01)) * 100)
}

export function thresholdLabel(benchmark: Benchmark) {
  return `${benchmark.direction === 'max' ? '<=' : '>='} ${benchmark.threshold}`
}
