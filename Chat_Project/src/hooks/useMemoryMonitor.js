// hooks/useMemoryMonitor.js
import { useEffect, useRef } from "react";

/**
 * Bellek trendini gözlemlemek için özel hook
 * - Chrome, Edge ve modern tarayıcılar destekler
 * - 5 saniyede bir ölçüm yapar
 * - Artış eğilimi varsa console.warn() yazar
 */
export default function useMemoryMonitor(intervalMs = 5000) {
  const historyRef = useRef([]);

  useEffect(() => {
    if (typeof performance === "undefined" || !performance.memory) {
      console.warn("🔍 Tarayıcı memory ölçümünü desteklemiyor.");
      return;
    }

    const measure = () => {
      const used = performance.memory.usedJSHeapSize / 1024 / 1024; // MB
      const total = performance.memory.jsHeapSizeLimit / 1024 / 1024;
      const entry = {
        time: new Date().toLocaleTimeString(),
        used: +used.toFixed(2),
        total: +total.toFixed(0),
      };

      // 60 kayıttan fazlasını tutma (yaklaşık 5dk)
      const h = historyRef.current;
      h.push(entry);
      if (h.length > 60) h.shift();

      // Ortalama ve trend hesapla
      const avg = h.reduce((a, b) => a + b.used, 0) / h.length;
      const trend = h[h.length - 1].used - h[0].used;

      console.log(
        `%c🧠 Heap: ${entry.used} MB / ${entry.total} MB  | Avg: ${avg.toFixed(
          2
        )} MB`,
        "color:#00BFFF;font-weight:bold;"
      );

      // Basit ASCII grafik (son 10 ölçüm)
      const bars = h
        .slice(-10)
        .map((e) => "▇".repeat(Math.round(e.used / 10)))
        .join(" ");
      console.log(`📊 ${bars}`);

      // Trend uyarısı
      if (h.length >= 10 && trend > 15) {
        console.warn(
          `⚠️ Bellek kullanımı artıyor (+${trend.toFixed(
            1
          )} MB). Memory leak olabilir.`
        );
      }
    };

    const timer = setInterval(measure, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
}
