/**
 * Algorithm comparison from TRAIN_MODEL/models/comparison_matrix.csv
 * (repeated GroupKFold by event, 5 folds x 3 repeats: scores are for events
 * the model never saw). Random Forest ranked 1st on every metric and is the
 * model deployed as best_model.h5. Re-copy these values after re-running train.py.
 */
export const MODEL_ALGORITHMS = ['Random Forest', 'Gradient Boosting', 'Linear Regression'] as const;

export const MODEL_COMPARISON: { metric: string; higherIsBetter: boolean; peso?: boolean; values: Record<(typeof MODEL_ALGORITHMS)[number], number> }[] = [
  { metric: 'R² (line item)', higherIsBetter: true, values: { 'Random Forest': 0.5058, 'Gradient Boosting': 0.4805, 'Linear Regression': 0.3998 } },
  { metric: 'R² (event total)', higherIsBetter: true, values: { 'Random Forest': 0.2715, 'Gradient Boosting': 0.2524, 'Linear Regression': 0.0941 } },
  { metric: 'R² (log unit cost)', higherIsBetter: true, values: { 'Random Forest': 0.921, 'Gradient Boosting': 0.9162, 'Linear Regression': 0.8922 } },
  { metric: 'MAE line item', higherIsBetter: false, peso: true, values: { 'Random Forest': 2648.6915, 'Gradient Boosting': 2760.0372, 'Linear Regression': 2994.6859 } },
  { metric: 'RMSE line item', higherIsBetter: false, peso: true, values: { 'Random Forest': 4678.3259, 'Gradient Boosting': 4795.3734, 'Linear Regression': 5156.0302 } },
  { metric: 'MAE event total', higherIsBetter: false, peso: true, values: { 'Random Forest': 6524.3208, 'Gradient Boosting': 6682.4681, 'Linear Regression': 7864.7496 } },
  { metric: 'MAPE event (%)', higherIsBetter: false, values: { 'Random Forest': 22.6554, 'Gradient Boosting': 23.7585, 'Linear Regression': 28.5457 } },
  { metric: 'Accuracy event (100 − MAPE %)', higherIsBetter: true, values: { 'Random Forest': 77.3446, 'Gradient Boosting': 76.2415, 'Linear Regression': 71.4543 } }
];

/** Training dataset summary (ncf_synthetic_budget_data_expanded.csv). */
export const TRAINING_DATASET = { rows: 213, events: 58, years: '2021–2026', file: 'ncf_synthetic_budget_data_expanded.csv' };

/**
 * Hyperparameter search per algorithm, from TRAIN_MODEL/models/tuning_log.csv:
 * how many configurations were tried, the best one, and the spread of
 * R² (line item) across all of them (a narrow spread = a stable algorithm).
 */
export const MODEL_TUNING: Record<(typeof MODEL_ALGORITHMS)[number], {
  configs: number;
  bestParams: string;
  r2Min: number;
  r2Max: number;
  howItLearns: string;
}> = {
  'Random Forest': {
    configs: 18,
    bestParams: '300 trees, max_features 0.3, min_samples_leaf 1',
    r2Min: 0.4308,
    r2Max: 0.5058,
    howItLearns: 'Averages 300 independent decision trees, each trained on a random sample of the data.'
  },
  'Gradient Boosting': {
    configs: 24,
    bestParams: '500 trees, learning_rate 0.03, max_depth 2',
    r2Min: 0.2055,
    r2Max: 0.4805,
    howItLearns: 'Adds trees one after another, each correcting the errors of the previous ones.'
  },
  'Linear Regression': {
    configs: 18,
    bestParams: 'Ridge alpha 0.3',
    r2Min: -1.0559,
    r2Max: 0.3998,
    howItLearns: 'Fits one straight-line formula over the features.'
  }
};

/** Chart colors per model (validated for color-vision deficiency on a light surface). */
export const MODEL_COLORS: Record<(typeof MODEL_ALGORITHMS)[number], string> = {
  'Random Forest': '#1A7F4E',
  'Gradient Boosting': '#C07F00',
  'Linear Regression': '#6F7FD0'
};
