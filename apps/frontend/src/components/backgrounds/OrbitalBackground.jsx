import { useEffect, useState } from 'react';
import DataVisualizationBackground from './DataVisualizationBackground';
import './OrbitalBackground.css';

export default function OrbitalBackground() {
  const [currentTime, setCurrentTime] = useState('--:-- UTC');
  const [coordinates, setCoordinates] = useState('--.--° N, --.--° W');
  const [dataRate, setDataRate] = useState('0 MB/s');

  useEffect(() => {
    const dataInterval = setInterval(() => {
      const now = new Date();
      const utcTime = now.toUTCString().split(' ')[4];
      setCurrentTime(utcTime);

      // Simulate ISS coordinates
      const lat = (Math.random() * 103 - 51.6).toFixed(2);
      const lon = (Math.random() * 360 - 180).toFixed(2);
      const latDir = parseFloat(lat) >= 0 ? 'N' : 'S';
      const lonDir = parseFloat(lon) >= 0 ? 'E' : 'W';
      setCoordinates(
        `${Math.abs(lat)}° ${latDir}, ${Math.abs(lon)}° ${lonDir}`
      );

      // Simulate data processing rate
      const rate = (Math.random() * 50 + 150).toFixed(1);
      setDataRate(`${rate} MB/s`);
    }, 2000);

    return () => {
      clearInterval(dataInterval);
    };
  }, []);

  return (
    <div className="orbital-background-container">
      <DataVisualizationBackground />

      {/* Vignette overlay */}
      <div className="vignette-overlay"></div>

      {/* Data overlay */}
      <div className="orbital-overlay">
        <div className="data-panel">
          <div className="data-item">
            <span className="data-label">DATA STREAMS</span>
            <span className="data-value">
              {(Math.random() * 900 + 100).toFixed(0)}
            </span>
          </div>
          <div className="data-item">
            <span className="data-label">PROCESSING RATE</span>
            <span className="data-value">{dataRate}</span>
          </div>
          <div className="data-item">
            <span className="data-label">NODES ACTIVE</span>
            <span className="data-value">
              {(Math.random() * 50 + 450).toFixed(0)}
            </span>
          </div>
          <div className="data-item">
            <span className="data-label">TIME (UTC)</span>
            <span className="data-value">{currentTime}</span>
          </div>
        </div>
      </div>

      <div className="grid-overlay"></div>
    </div>
  );
}
