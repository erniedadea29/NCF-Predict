/**
 * Minimal, dependency-free Random Forest regressor.
 *
 * - Each tree is a CART regression tree grown on a bootstrap sample.
 * - At every split only a random subset of features is considered.
 * - Splits minimise the sum of squared errors (variance reduction).
 * - Prediction is the mean of all trees; the spread across trees is
 *   exposed so callers can build prediction intervals.
 * - Feature importance = total SSE reduction per feature, normalised to 1.
 */

export type RNG = () => number;

/** Small seeded PRNG so training is deterministic across renders. */
export function mulberry32(seed: number): RNG {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal sample via Box-Muller. */
export function gaussian(rng: RNG): number {
  const u = Math.max(rng(), 1e-12);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

type TreeNode =
  | { leaf: true; value: number }
  | { leaf: false; feature: number; threshold: number; left: TreeNode; right: TreeNode };

export interface RandomForestOptions {
  nTrees?: number;
  maxDepth?: number;
  minSamplesLeaf?: number;
  /** Number of features tried per split. Defaults to ceil(nFeatures / 3). */
  maxFeatures?: number;
  seed?: number;
}

export class RandomForestRegressor {
  private trees: TreeNode[] = [];
  private nTrees: number;
  private maxDepth: number;
  private minSamplesLeaf: number;
  private maxFeaturesOpt?: number;
  private rng: RNG;
  private importances: number[] = [];

  constructor(opts: RandomForestOptions = {}) {
    this.nTrees = opts.nTrees ?? 100;
    this.maxDepth = opts.maxDepth ?? 10;
    this.minSamplesLeaf = opts.minSamplesLeaf ?? 2;
    this.maxFeaturesOpt = opts.maxFeatures;
    this.rng = mulberry32(opts.seed ?? 42);
  }

  get treeCount(): number {
    return this.trees.length;
  }

  /** Normalised feature importances (sum to 1). */
  get featureImportances(): number[] {
    const total = this.importances.reduce((s, v) => s + v, 0);
    return this.importances.map(v => (total > 0 ? v / total : 0));
  }

  fit(X: number[][], y: number[]): this {
    if (X.length === 0 || X.length !== y.length) {
      throw new Error('RandomForestRegressor.fit: X and y must be non-empty and the same length');
    }
    const nFeatures = X[0].length;
    const maxFeatures = Math.min(nFeatures, Math.max(1, this.maxFeaturesOpt ?? Math.ceil(nFeatures / 3)));
    this.importances = new Array(nFeatures).fill(0);
    this.trees = [];

    for (let t = 0; t < this.nTrees; t++) {
      const sample: number[] = new Array(X.length);
      for (let i = 0; i < X.length; i++) sample[i] = Math.floor(this.rng() * X.length);
      this.trees.push(this.grow(X, y, sample, 0, nFeatures, maxFeatures));
    }
    return this;
  }

  /** Predictions of every individual tree for one input row. */
  predictAll(x: number[]): number[] {
    return this.trees.map(tree => {
      let node: TreeNode = tree;
      while (node.leaf === false) node = x[node.feature] <= node.threshold ? node.left : node.right;
      return node.value;
    });
  }

  predict(x: number[]): number {
    const preds = this.predictAll(x);
    return preds.reduce((s, v) => s + v, 0) / preds.length;
  }

  /** Ensemble mean plus standard deviation across trees. */
  predictWithSpread(x: number[]): { mean: number; std: number } {
    const preds = this.predictAll(x);
    const mean = preds.reduce((s, v) => s + v, 0) / preds.length;
    const variance = preds.reduce((s, v) => s + (v - mean) ** 2, 0) / preds.length;
    return { mean, std: Math.sqrt(variance) };
  }

  private grow(
    X: number[][],
    y: number[],
    idx: number[],
    depth: number,
    nFeatures: number,
    maxFeatures: number
  ): TreeNode {
    let sum = 0;
    let sumSq = 0;
    for (const i of idx) {
      sum += y[i];
      sumSq += y[i] * y[i];
    }
    const n = idx.length;
    const mean = sum / n;
    const parentSSE = sumSq - (sum * sum) / n;

    if (depth >= this.maxDepth || n < 2 * this.minSamplesLeaf || parentSSE <= 1e-12) {
      return { leaf: true, value: mean };
    }

    // Random feature subset (partial Fisher-Yates)
    const features = Array.from({ length: nFeatures }, (_, i) => i);
    for (let i = 0; i < maxFeatures; i++) {
      const j = i + Math.floor(this.rng() * (nFeatures - i));
      [features[i], features[j]] = [features[j], features[i]];
    }

    let bestSSE = Infinity;
    let bestFeature = -1;
    let bestThreshold = 0;

    for (let f = 0; f < maxFeatures; f++) {
      const feature = features[f];
      const sorted = [...idx].sort((a, b) => X[a][feature] - X[b][feature]);
      let leftSum = 0;
      let leftSq = 0;
      for (let k = 0; k < n - 1; k++) {
        const yi = y[sorted[k]];
        leftSum += yi;
        leftSq += yi * yi;
        const nL = k + 1;
        const nR = n - nL;
        if (nL < this.minSamplesLeaf || nR < this.minSamplesLeaf) continue;
        const xv = X[sorted[k]][feature];
        const xNext = X[sorted[k + 1]][feature];
        if (xv === xNext) continue;
        const rightSum = sum - leftSum;
        const rightSq = sumSq - leftSq;
        const sse = leftSq - (leftSum * leftSum) / nL + rightSq - (rightSum * rightSum) / nR;
        if (sse < bestSSE) {
          bestSSE = sse;
          bestFeature = feature;
          bestThreshold = (xv + xNext) / 2;
        }
      }
    }

    if (bestFeature === -1) return { leaf: true, value: mean };

    this.importances[bestFeature] += parentSSE - bestSSE;
    const leftIdx: number[] = [];
    const rightIdx: number[] = [];
    for (const i of idx) (X[i][bestFeature] <= bestThreshold ? leftIdx : rightIdx).push(i);

    return {
      leaf: false,
      feature: bestFeature,
      threshold: bestThreshold,
      left: this.grow(X, y, leftIdx, depth + 1, nFeatures, maxFeatures),
      right: this.grow(X, y, rightIdx, depth + 1, nFeatures, maxFeatures)
    };
  }
}
