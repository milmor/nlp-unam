'use client';

import { useEffect, useRef } from 'react';
import {
  Chart,
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from 'chart.js';

Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip);

interface SemesterData {
  calculus: number;
  linear_algebra: number;
  probability: number;
  statistics: number;
  programming: number;
}

interface RadarChartProps {
  semester: string;
  data: SemesterData;
  responses: number;
}

const LABELS = ['Calculus', ['Linear', 'Algebra'], 'Probability', 'Statistics', 'Program.'];

function getChartColors(isDark: boolean) {
  return {
    backgroundColor: isDark ? 'rgba(107, 163, 214, 0.3)' : 'rgba(0, 51, 102, 0.2)',
    borderColor: isDark ? 'rgba(107, 163, 214, 1)' : 'rgba(0, 51, 102, 1)',
    pointBackgroundColor: isDark ? 'rgba(232, 208, 120, 1)' : 'rgba(207, 181, 59, 1)',
    gridColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    textColor: isDark ? '#e8e8e8' : '#1a1a1a',
  };
}

export default function RadarChart({ semester, data, responses }: RadarChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const colors = getChartColors(isDark);

    chartRef.current = new Chart(canvasRef.current, {
      type: 'radar',
      data: {
        labels: LABELS,
        datasets: [
          {
            label: `Semester ${semester}`,
            data: [
              data.calculus,
              data.linear_algebra,
              data.probability,
              data.statistics,
              data.programming,
            ],
            backgroundColor: colors.backgroundColor,
            borderColor: colors.borderColor,
            borderWidth: 2,
            pointBackgroundColor: colors.pointBackgroundColor,
            pointBorderColor: colors.borderColor,
            pointRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: 20 },
        scales: {
          r: {
            beginAtZero: true,
            min: 0,
            max: 5,
            ticks: {
              stepSize: 1,
              color: colors.textColor,
              backdropColor: 'transparent',
              font: { size: 10 },
            },
            grid: { color: colors.gridColor },
            angleLines: { color: colors.gridColor },
            pointLabels: {
              color: colors.textColor,
              font: { size: 13, weight: 'bold' },
            },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${(ctx.raw as number).toFixed(2)}/5`,
            },
          },
        },
      },
    });

    // Update colors when theme changes
    const observer = new MutationObserver(() => {
      const chart = chartRef.current;
      if (!chart) return;
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      const c = getChartColors(dark);
      // Use type assertion to access point-specific dataset props
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ds = chart.data.datasets[0] as any;
      ds.backgroundColor = c.backgroundColor;
      ds.borderColor = c.borderColor;
      ds.pointBackgroundColor = c.pointBackgroundColor;
      ds.pointBorderColor = c.borderColor;
      if (chart.options.scales?.r) {
        const r = chart.options.scales.r as {
          ticks: { color: string };
          grid: { color: string };
          angleLines: { color: string };
          pointLabels: { color: string };
        };
        r.ticks.color = c.textColor;
        r.grid.color = c.gridColor;
        r.angleLines.color = c.gridColor;
        r.pointLabels.color = c.textColor;
      }
      chart.update();
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      observer.disconnect();
      chartRef.current?.destroy();
    };
  }, [data, semester]);

  return (
    <div className="chart-card">
      <h3>Semester {semester}</h3>
      <p className="chart-responses">{responses} responses</p>
      <div className="chart-container">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
