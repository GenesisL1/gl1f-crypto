// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Plain names for signals: "Common name (machine_name)". Machine names stay the identifiers stored in models.
import { WORLD_META } from "./world_signals.js";

const span = (h) => ({ 1: "1 hour", 168: "7 days", 336: "14 days", 504: "3 weeks", 72: "3 days", 48: "2 days" }[h] || `${h} hours`);
const RULES = [
  [/^ret_(\d+)h$/, (m) => `Return, ${span(+m[1])}`], [/^ret_1h_lag(\d+)$/, (m) => `Candle return, ${m[1]} candle${m[1] === "1" ? "" : "s"} back`],
  [/^realized_vol_(\d+)h$/, (m) => `Realized volatility, ${span(+m[1])}`], [/^rv_(\d+)h$/, (m) => `Return volatility, ${span(+m[1])}`],
  [/^park_(\d+)h$/, (m) => `Parkinson volatility, ${span(+m[1])}`], [/^gk_(\d+)h$/, (m) => `Garman-Klass volatility, ${span(+m[1])}`], [/^rs_(\d+)h$/, (m) => `Rogers-Satchell volatility, ${span(+m[1])}`],
  [/^roc_(\d+)h$/, (m) => `Rate of change, ${span(+m[1])}`], [/^ema_ratio_(\d+)h$/, (m) => `Price vs ${m[1]}-hour average (EMA)`],
  [/^dist_(high|low)_(\d+)h$/, (m) => `Distance from the ${span(+m[2])} ${m[1]}`], [/^rv_log_change_(\d+)h$/, (m) => `Volatility change, ${span(+m[1])}`],
  [/^(rsi|willr|stoch_k|mfi|cci|adx)_(\d+)h$/, (m) => `${{ rsi: "RSI", willr: "Williams %R", stoch_k: "Stochastic %K", mfi: "Money Flow Index", cci: "Commodity Channel Index", adx: "Trend strength (ADX)" }[m[1]]}, ${span(+m[2])}`],
  [/^ret_(\d+)h_log_bps$/, (m) => `Return, ${span(+m[1])} (bps)`], [/^btc_ret_(\d+)h(_log_bps)?$/, (m) => `BTC return, ${span(+m[1])}${m[2] ? " (bps)" : ""}`],
];
const NAMES = {
  parkinson_24: "Parkinson volatility, 24 hours", gk_24: "Garman-Klass volatility, 24 hours", atr_14_rel: "Average true range (14) vs price", atr_24_rel: "Average true range (24) vs price",
  atr_pct_14: "Average true range (14), percent", tr_pct: "True range, percent", macd: "MACD line", macd_signal: "MACD signal line", macd_hist: "MACD histogram",
  close_to_ema5: "Price vs 5-candle average (EMA)", bb_pctb_20h: "Bollinger %B, 20 hours", bb_width_20h: "Bollinger band width, 20 hours", log_volume: "Volume (log)",
  vol_z_24: "Volume vs normal, 24 candles", vol_z_168: "Volume vs normal, 168 candles", vol_ma_ratio_24h: "Volume vs 24-hour average", taker_buy_ratio: "Taker buy share",
  taker_imbalance: "Buy/sell pressure (taker imbalance)", taker_imbalance_ma_6h: "Buy/sell pressure, 6-hour average", taker_imbalance_ma_24h: "Buy/sell pressure, 24-hour average",
  obv_z_168h: "On-balance volume vs normal, 7 days", vwap_dev_24h: "Distance from the 24-hour VWAP", vwap_dev_72h: "Distance from the 3-day VWAP", body_ratio: "Candle body share of range",
  upper_wick: "Upper wick", lower_wick: "Lower wick", gap_open: "Opening gap", log_trades: "Number of trades (log)", log_avg_trade_size: "Average trade size (log)",
  funding_rate: "Funding rate", funding_rate_ma_24h: "Funding rate, 24-hour average", funding_rate_ma_72h: "Funding rate, 3-day average", funding_rate_change: "Funding rate change",
  funding_cum_24h: "Funding paid, 24 hours", funding_positive_frac_168h: "Share of positive funding, 7 days", hour_sin: "Hour of day (sine)", hour_cos: "Hour of day (cosine)",
  dow_sin: "Day of week (sine)", dow_cos: "Day of week (cosine)", is_weekend: "Weekend", is_friday: "Friday", atr_14_pct: "Average true range (14) as % of price",
  atr_48_pct: "Average true range (48) as % of price", rv_short_vs_long_504: "Short vs long volatility", rv_medium_vs_long: "Medium vs long volatility",
  rv24_rank_168: "24-hour volatility rank, 7 days", rv24_rank_504: "24-hour volatility rank, 3 weeks", vol_of_vol_168: "Volatility of volatility, 7 days", vol_of_vol_504: "Volatility of volatility, 3 weeks",
  jumps_2sigma_168h: "Price jumps above 2 sigma, 7 days", max_abs_ret_scaled_24h: "Largest move vs volatility, 24 hours", max_abs_ret_scaled_168h: "Largest move vs volatility, 7 days",
  jump_ratio_24h: "Jump share of variance, 24 hours", jump_ratio_72h: "Jump share of variance, 3 days", neg_var_24h: "Downside variance, 24 hours", pos_var_24h: "Upside variance, 24 hours",
  neg_var_72h: "Downside variance, 3 days", pos_var_168h: "Upside variance, 7 days", semivol_ratio_72h: "Downside vs upside volatility, 3 days", semivol_ratio_168h: "Downside vs upside volatility, 7 days",
  hl_range_mean_24h: "Average high-low range, 24 hours", hl_range_mean_168h: "Average high-low range, 7 days", hl_range_max_72h: "Largest high-low range, 3 days",
  hl_range_max_168h: "Largest high-low range, 7 days", taker_imbalance_abs_ma_24h: "Buy/sell pressure strength, 24-hour average", r1_log: "Last candle return (log)",
  r12_log: "Return over 12 candles (log)", RSI14: "RSI, 14 candles", ATR_norm14: "Average true range (14) vs price", body_range_ratio: "Body vs range", BollBW50: "Bollinger band width, 50 candles",
  ATR_ratio100: "Volatility vs its 100-candle average", BW_CHOP100: "Choppiness, 100 candles", ATR_HL_ratio100: "True range vs high-low range, 100 candles", TrendConsist100: "Trend consistency, 100 candles",
  return_5_3: "Return over 3 candles", return_60_3: "Return over 36 candles", volatility_5: "Volatility, 5 candles", mom_5: "Momentum, 5 candles", hour: "Hour of day (UTC)", dow: "Day of week (UTC)",
  dist_ema5_atr: "Distance from the 5-candle average, in ATRs", rv6_over_rv24: "6-hour vs 24-hour volatility", body_signed_3: "Candle bodies, 3 candles", wick_imbalance_3: "Wick imbalance, 3 candles",
  volume_surge_3: "Volume surge vs 6-hour average", taker_imb_sum_6: "Buy/sell pressure, 6-candle sum", ret_skew_24h: "Return skew, 24 hours", sign_persist_12: "Direction persistence, 12 candles",
  range_efficiency_6: "Trend efficiency, 6 candles", trend_r2_12: "Trend fit (R squared), 12 candles", dist_high24_atr: "Distance from the 24-hour high, in ATRs", dist_low24_atr: "Distance from the 24-hour low, in ATRs",
  relative_ret_btc_4h: "Return vs BTC, 4 hours", relative_ret_btc_24h: "Return vs BTC, 24 hours", btc_residual_4h: "Move not explained by BTC, 4 hours", btc_corr_7d: "Correlation with BTC, 7 days",
  btc_beta_7d: "Sensitivity to BTC (beta), 7 days", coin_btc_breakout_24h: "Breakout vs BTC, 24 hours", btc_realized_vol_4h: "BTC volatility, 4 hours",
  ema5_native_logdist_bps: "Distance from the 5-candle average (bps)", ema5_native_dist_atr: "Distance from the 5-candle average, in ATRs", ema5_native_slope3_atr: "Slope of the 5-candle average, in ATRs",
  atr14_native_bps: "Average true range, 14 candles (bps)", atr100_native_bps: "Average true range, 100 candles (bps)", breakout_high_4h_rv: "Breakout above the 4-hour high vs volatility",
  dist_high_24h_rv: "Distance from the 24-hour high vs volatility", dist_low_24h_rv: "Distance from the 24-hour low vs volatility", efficiency_4h_signed: "Trend efficiency, 4 hours",
  ema20_1h_logdist_bps: "Distance from the 20-hour average (bps)", ema20_1h_slope4_atr: "Slope of the 20-hour average, in ATRs", rv_1h_bps: "Volatility, 1 hour (bps)", rv_4h_bps: "Volatility, 4 hours (bps)",
  rv_24h_bps: "Volatility, 24 hours (bps)", rv_4h_vs_24h_log: "4-hour vs 24-hour volatility", rv_24h_rank_7d: "24-hour volatility rank, 7 days", bb_logwidth_4h_bps: "Bollinger band width, 4 hours (bps)",
  bb_logwidth_4h_rank_7d: "Bollinger band width rank, 7 days", downside_variation_share_4h: "Downside share of moves, 4 hours", volume_activity_1h: "Volume activity, 1 hour", volume_activity_4h: "Volume activity, 4 hours",
  trades_activity_1h: "Trade count activity, 1 hour", taker_imbalance_1h: "Buy/sell pressure, 1 hour", taker_imbalance_4h: "Buy/sell pressure, 4 hours", body_signed_native: "Candle body (signed)",
  wick_imbalance_native: "Wick imbalance", relative_btc_ret_4h_log_bps: "Return vs BTC, 4 hours (bps)", relative_btc_ret_24h_log_bps: "Return vs BTC, 24 hours (bps)",
  btc_residual_4h_log_bps: "Move not explained by BTC, 4 hours (bps)", coin_btc_breakout_24h_log_bps: "Breakout vs BTC, 24 hours (bps)", btc_rv_4h_bps: "BTC volatility, 4 hours (bps)",
  btc_residual_4h_z: "Move not explained by BTC vs normal, 4 hours", btc_corr_change_1d_7d: "Change in BTC correlation (1 day vs 7 days)", utc_day_sin: "Time of day (sine)", utc_day_cos: "Time of day (cosine)",
  utc_week_sin: "Time of week (sine)", utc_week_cos: "Time of week (cosine)", funding_mean_24h_bps: "Funding rate, 24-hour mean (bps)", funding_paid_24h_bps: "Funding paid, 24 hours (bps)",
};
export function featureLabel(name) {
  if (WORLD_META[name]) return WORLD_META[name].label;
  if (NAMES[name]) return NAMES[name];
  for (const [re, fn] of RULES) { const m = name.match(re); if (m) return fn(m); }
  return name;
}
export const featureTitle = (name) => `${featureLabel(name)} (${name})`;
