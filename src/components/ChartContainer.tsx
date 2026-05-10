import { useEffect, useRef, useState, useMemo } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, Time, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts';
import { useTradingStore } from '../store/useTradingStore';

// Simple EMA calculation
function calculateEMA(data: any[], period: number) {
  if (!data || data.length === 0) return [];
  const k = 2 / (period + 1);
  let emaData = [];
  let currentEma = data[0].close || 0;
  
  for (let i = 0; i < data.length; i++) {
    const close = data[i].close || 0;
    currentEma = (close - currentEma) * k + currentEma;
    if (!isNaN(currentEma)) {
      emaData.push({ time: data[i].time, value: currentEma });
    }
  }
  return emaData;
}

// Simple RSI calculation
function calculateRSI(data: any[], period: number = 14) {
  if (!data || data.length <= period) return [];
  let rsiData = [];
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = (data[i]?.close || 0) - (data[i - 1]?.close || 0);
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period; i < data.length; i++) {
    const diff = (data[i]?.close || 0) - (data[i - 1]?.close || 0);
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    let rs = avgGain / (avgLoss === 0 ? 1 : avgLoss);
    let rsi = 100 - (100 / (1 + rs));
    
    if (!isNaN(rsi)) {
      rsiData.push({ time: data[i].time, value: rsi });
    }
  }
  return rsiData;
}

// Simple MACD calculation (12, 26, 9)
function calculateMACD(data: any[]) {
  if (!data || data.length === 0) return { macdLine: [], signalLine: [], histogram: [] };
  const ema12 = calculateEMA(data, 12);
  const ema26 = calculateEMA(data, 26);
  
  let macdLine = [];
  for (let i = 0; i < data.length; i++) {
    const val12 = ema12[i]?.value;
    const val26 = ema26[i]?.value;
    if (val12 !== undefined && val26 !== undefined && !isNaN(val12) && !isNaN(val26)) {
      macdLine.push({
        time: data[i].time,
        value: val12 - val26
      });
    }
  }
  
  const signalLine = calculateEMA(macdLine, 9);
  
  let histogram = [];
  for (let i = 0; i < signalLine.length; i++) {
    const time = signalLine[i].time;
    const macdItem = macdLine.find(m => m.time === time);
    if (macdItem && !isNaN(macdItem.value) && !isNaN(signalLine[i].value)) {
      const histValue = macdItem.value - signalLine[i].value;
      histogram.push({
        time: time,
        value: histValue,
        color: histValue >= 0 ? '#10B981' : '#EF4444'
      });
    }
  }
  
  return { macdLine, signalLine, histogram };
}

export function ChartContainer() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  
  // Indicator Refs
  const emaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdLineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdSignalRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdHistRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  const symbol = useTradingStore((s) => s.symbol);
  const timeframe = useTradingStore((s) => s.timeframe);
  const indicators = useTradingStore((s) => s.indicators);
  const { highlightAction, suggestedPrice } = useTradingStore();

  const activeSymbol = symbol.replace('BINANCE:', '').toLowerCase();

  // Initialization of Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const handleResize = () => {
      if (!chartContainerRef.current) return;
      try {
        chartRef.current?.applyOptions({ 
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      } catch (e) {}
    };

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#171717' }, 
        textColor: '#A3A3A3', 
      },
      grid: {
        vertLines: { color: '#262626' }, 
        horzLines: { color: '#262626' },
      },
      crosshair: {
        mode: 1, 
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });

    // Create Main Series
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#10B981', 
      downColor: '#EF4444', 
      borderVisible: false,
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
    });
    
    // Create Indicator Panes using Price Scales
    chart.priceScale('right').applyOptions({
      scaleMargins: { top: 0.1, bottom: 0.35 },
    });

    // EMA Series
    const emaSeries = chart.addSeries(LineSeries, {
      color: '#6366f1',
      lineWidth: 2,
      priceScaleId: 'right',
      visible: indicators.ema
    });

    // RSI Series
    const rsiSeries = chart.addSeries(LineSeries, {
      color: '#F59E0B',
      lineWidth: 2,
      priceScaleId: 'rsi',
      visible: indicators.rsi
    });

    // MACD Series
    const macdHist = chart.addSeries(HistogramSeries, {
      priceScaleId: 'macd',
      visible: indicators.macd
    });
    const macdLine = chart.addSeries(LineSeries, {
      color: '#3B82F6',
      lineWidth: 2,
      priceScaleId: 'macd',
      visible: indicators.macd
    });
    const macdSignal = chart.addSeries(LineSeries, {
      color: '#F97316',
      lineWidth: 2,
      priceScaleId: 'macd',
      visible: indicators.macd
    });

    chart.priceScale('rsi').applyOptions({
      scaleMargins: { top: 0.65, bottom: 0.2 },
      visible: true,
      borderColor: '#262626'
    });

    chart.priceScale('macd').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
      visible: true,
      borderColor: '#262626'
    });

    chartRef.current = chart;
    seriesRef.current = series;
    emaSeriesRef.current = emaSeries;
    rsiSeriesRef.current = rsiSeries;
    macdHistRef.current = macdHist;
    macdLineRef.current = macdLine;
    macdSignalRef.current = macdSignal;

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []); // Run once on mount

  // Fetch Historic Data and Setup Websocket
  useEffect(() => {
    if (!seriesRef.current || !activeSymbol) return;

    let isDisposed = false;
    let ws: WebSocket;
    
    const fetchHistory = async () => {
      try {
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${activeSymbol.toUpperCase()}&interval=${timeframe}&limit=500`);
        const json = await res.json();
        if (isDisposed) return;
        
        const cdata = json.map((d: any) => ({
          time: Math.floor(d[0] / 1000) as Time,
          open: parseFloat(d[1]),
          high: parseFloat(d[2]),
          low: parseFloat(d[3]),
          close: parseFloat(d[4]),
        }));

        seriesRef.current?.setData(cdata);
        updateIndicators(cdata);

        // Connect Websocket
        ws = new WebSocket(`wss://stream.binance.com:9443/ws/${activeSymbol}@kline_${timeframe}`);
        
        ws.onmessage = (event) => {
          if (isDisposed) return;
          const message = JSON.parse(event.data);
          const kline = message.k;
          
          const tick = {
            time: Math.floor(kline.t / 1000) as Time,
            open: parseFloat(kline.o),
            high: parseFloat(kline.h),
            low: parseFloat(kline.l),
            close: parseFloat(kline.c),
          };
          
          seriesRef.current?.update(tick);
          
          // Re-adding the tick to our cdata array and recalculating latest indicators could be heavy
          // For simplicity we just recalculate indicators with new array on each message if needed
          // Real-world: Should calculate single update tick for indicators instead of full recalculation
        };

      } catch (err) {
        if (!isDisposed) {
          console.error('Failed to fetch historic data', err);
        }
      }
    };

    fetchHistory();

    return () => {
      isDisposed = true;
      if (ws) ws.close();
    };
  }, [activeSymbol, timeframe]);

  // Handle Indicator Toggles
  useEffect(() => {
    emaSeriesRef.current?.applyOptions({ visible: indicators.ema });
    rsiSeriesRef.current?.applyOptions({ visible: indicators.rsi });
    macdHistRef.current?.applyOptions({ visible: indicators.macd });
    macdLineRef.current?.applyOptions({ visible: indicators.macd });
    macdSignalRef.current?.applyOptions({ visible: indicators.macd });
    
    // Adjust margins dynamically
    const hasRSI = indicators.rsi;
    const hasMACD = indicators.macd;
    
    chartRef.current?.priceScale('right').applyOptions({
      scaleMargins: { 
        top: 0.1, 
        bottom: hasRSI && hasMACD ? 0.35 : (hasRSI || hasMACD ? 0.25 : 0.05) 
      },
    });
    
    if (hasRSI) {
       try {
         chartRef.current?.priceScale('rsi').applyOptions({
           scaleMargins: { top: hasMACD ? 0.65 : 0.75, bottom: hasMACD ? 0.2 : 0 },
         });
       } catch(e) {}
    }
    if (hasMACD) {
       try {
         chartRef.current?.priceScale('macd').applyOptions({
           scaleMargins: { top: hasRSI ? 0.8 : 0.75, bottom: 0 },
         });
       } catch(e) {}
    }
  }, [indicators]);

  const updateIndicators = (cdata: any[]) => {
    const emaData = calculateEMA(cdata, 20);
    emaSeriesRef.current?.setData(emaData);

    const rsiData = calculateRSI(cdata, 14);
    rsiSeriesRef.current?.setData(rsiData);

    const { macdLine, signalLine, histogram } = calculateMACD(cdata);
    macdLineRef.current?.setData(macdLine);
    macdSignalRef.current?.setData(signalLine);
    macdHistRef.current?.setData(histogram);
  };

  // Handle highlighted actions (AI recommendations)
  useEffect(() => {
    if (!seriesRef.current || !highlightAction || !suggestedPrice) return;

    const priceLine = {
      price: suggestedPrice,
      color: highlightAction === 'BUY' ? '#10B981' : '#EF4444',
      lineWidth: 2 as const,
      lineStyle: 2 as const,
      axisLabelVisible: true,
      title: `${highlightAction} ZONE`,
    };
    
    const lineObj = seriesRef.current.createPriceLine(priceLine);

    return () => {
      if (seriesRef.current) {
         seriesRef.current.removePriceLine(lineObj);
      }
    };
  }, [highlightAction, suggestedPrice]);

  return (
    <div className="w-full h-full relative" ref={chartContainerRef} />
  );
}
