import { useState, useEffect } from 'react';
import './index.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);

  // Fetch test data from backend API
  const testConnection = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/test`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setData({ message: 'Failed to connect to backend', status: 'Offline' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  return (
    <div className="container">
      <div className="card">
        {/* Badges */}
        <div className="badge-row">
          <span className="badge node">Node.js</span>
          <span className="badge react">React</span>
          <span className="badge docker">Railway Ready</span>
        </div>

        {/* Title */}
        <h1>Fullstack Test App</h1>
        <p className="subtitle">Single-page test with Node.js backend and React frontend</p>

        {/* Status Box */}
        <div className="status-box">
          <div className="status-header">
            <span className={`status-dot ${data?.status === 'Connected' ? 'online' : 'offline'}`}></span>
            <strong>Backend Status: {loading ? 'Checking...' : data?.status}</strong>
          </div>
          <p className="response-text">
            {loading ? 'Fetching /api/test...' : `"${data?.message}"`}
          </p>
          {data?.timestamp && <span className="timestamp">Server time: {data.timestamp}</span>}
        </div>

        {/* Actions */}
        <div className="button-group">
          <button id="test-btn" className="btn btn-primary" onClick={testConnection} disabled={loading}>
            {loading ? 'Connecting...' : 'Test Backend API'}
          </button>
          <button id="counter-btn" className="btn btn-secondary" onClick={() => setCount(count + 1)}>
            React State Click: {count}
          </button>
        </div>

        {/* Footer */}
        <div className="footer-info">
          <span>Railway Deployed</span>
          <span>•</span>
          <span>Docker Container</span>
        </div>
      </div>
    </div>
  );
}
