import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, ColorType, CrosshairMode } from "lightweight-charts";

export default function App() {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);

  const [market, setMarket] = useState(null);
  const [signal, setSignal] = useState(null);

  async function loadData() {
    try {
      const marketRes = await fetch(`/api/market?ts=${Date.now()}`);
      const marketJson = await marketRes.json();

      const signalRes = await fetch(`/api/signal?ts=${Date.now()}`);
      const signalJson = await signalRes.json();

      setMarket(marketJson);
      setSignal(signalJson);
    } catch (err) {
      console.log(err);
    }
  }

  useEffect(() => {
    loadData();

    const interval = setInterval(() => {
      loadData();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,

      layout: {
        background: {
          type: ColorType.Solid,
          color: "#070b17"
        },
        textColor: "#cbd5e1"
      },

      grid: {
        vertLines: {
          color: "rgba(255,255,255,0.05)"
        },
        horzLines: {
          color: "rgba(255,255,255,0.05)"
        }
      },

      crosshair: {
        mode: CrosshairMode.Normal
      },

      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.1)"
      },

      timeScale: {
        borderColor: "rgba(255,255,255,0.1)",
        timeVisible: true,
        secondsVisible: false
      }
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#19f28f",
      downColor: "#ff4d6d",

      borderUpColor: "#19f28f",
      borderDownColor: "#ff4d6d",

      wickUpColor: "#19f28f",
      wickDownColor: "#ff4d6d"
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions({
        width: chartContainerRef.current.clientWidth
      });
    });

    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  const tvCandles = useMemo(() => {
    if (!market?.candles) return [];

    return market.candles
      .map((candle) => {
        const fixed = String(candle.time)
          .replace(/\./g, "-")
          .replace(" ", "T");

        const timestamp = Math.floor(
          new Date(fixed).getTime() / 1000
        );

        return {
          time: timestamp,
          open: Number(candle.open),
          high: Number(candle.high),
          low: Number(candle.low),
          close: Number(candle.close)
        };
      })
      .filter((c) =>
        !isNaN(c.time) &&
        isFinite(c.open) &&
        isFinite(c.high) &&
        isFinite(c.low) &&
        isFinite(c.close)
      );
  }, [market]);

  useEffect(() => {
    if (!candleSeriesRef.current) return;
    if (!tvCandles.length) return;

    console.log("Realtime Candles:", tvCandles);

    candleSeriesRef.current.setData(tvCandles);

    chartRef.current.timeScale().fitContent();
  }, [tvCandles]);

  return (
    <div className="app">
      <div className="hero">
        <div className="left">
          <h1>
            RSI + EMA Cross 9/20
            <br />
            + Order Block 🔥
          </h1>

          <p>
            Sinyal sekarang baca candle realtime MT5.
            RSI, EMA, dan Order Block otomatis update tiap refresh.
          </p>
        </div>

        <div className="right">
          <h2>{signal?.signal || "WAIT"}</h2>

          <div className="signal-grid">
            <div>
              <span>Entry</span>
              <strong>{signal?.entry || "-"}</strong>
            </div>

            <div>
              <span>SL</span>
              <strong>{signal?.sl || "-"}</strong>
            </div>

            <div>
              <span>TP</span>
              <strong>{signal?.tp || "-"}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="stats">
        <div className="card">
          <span>RSI 14</span>
          <strong>{signal?.strategy?.rsi || "-"}</strong>
        </div>

        <div className="card">
          <span>EMA 9</span>
          <strong>{signal?.strategy?.ema9 || "-"}</strong>
        </div>

        <div className="card">
          <span>EMA 20</span>
          <strong>{signal?.strategy?.ema20 || "-"}</strong>
        </div>

        <div className="card">
          <span>EMA Cross</span>
          <strong>{signal?.strategy?.emaCross || "-"}</strong>
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-header">
          <h2>TradingView Lightweight Candlestick</h2>
          <span>
            {market?.symbol || "XAUUSD"} · {market?.timeframe || "M1"}
          </span>
        </div>

        <div
          ref={chartContainerRef}
          style={{
            width: "100%",
            height: "500px"
          }}
        />
      </div>
    </div>
  );
}
```
