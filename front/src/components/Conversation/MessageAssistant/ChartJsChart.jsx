import { memo, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { selectRenderChartjs } from "../../../Redux/reducers/userSettingsReducer";
import Code from "./Code";
import RenderCodeToggle from "./RenderCodeToggle";

let chartPromise;
let chartRegistered = false;

const loadChart = () => {
  if (!chartPromise) {
    chartPromise = import("chart.js").then((module) => {
      if (!chartRegistered) {
        module.Chart.register(...module.registerables);
        chartRegistered = true;
      }
      return module.Chart;
    });
  }
  return chartPromise;
};

const ChartJsChart = memo(({ content, language = "chart" }) => {
  const { t } = useTranslation();
  const chartjsEnabled = useSelector(selectRenderChartjs);
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [showCode, setShowCode] = useState(!chartjsEnabled);
  const [error, setError] = useState("");

  useEffect(() => {
    setShowCode(!chartjsEnabled);
  }, [chartjsEnabled]);

  useEffect(() => {
    if (showCode) return;
    if (!content || !content.trim()) {
      setError("");
      return;
    }

    let cancelled = false;
    const canvas = canvasRef.current;
    setError("");

    const timer = setTimeout(async () => {
      try {
        const config = JSON.parse(content);
        const Chart = await loadChart();
        if (cancelled || !canvas) return;
        chartRef.current = new Chart(canvas, config);
      } catch (err) {
        console.error("Chart.js rendering error:", err);
        if (!cancelled) setError(err?.message || t("chartjs.render_error"));
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [content, t, showCode]);

  const codeContent = String(content || "").replace(/\n$/, "");
  if (!codeContent.trim()) return null;

  return (
    <div className="relative my-2">
      <RenderCodeToggle
        showCode={showCode}
        onToggle={() => setShowCode((prev) => !prev)}
        renderLabel={t("conversation.chartjs_block.render")}
        showCodeLabel={t("conversation.chartjs_block.show_code")}
      />

      {showCode ? (
        <div className="pt-3">
          <Code language={language}>{codeContent}</Code>
        </div>
      ) : error ? (
        <div className="pt-3 p-2 text-error">
          {t("chartjs.render_error")}
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-base-200 p-2 font-mono text-xs">
            {error}
          </pre>
        </div>
      ) : (
        <div className="chartjs-chart mt-2 rounded-lg bg-base-100 p-2">
          <div className="relative h-72 w-full">
            <canvas ref={canvasRef} />
          </div>
        </div>
      )}
    </div>
  );
});

ChartJsChart.displayName = "ChartJsChart";

export default ChartJsChart;
