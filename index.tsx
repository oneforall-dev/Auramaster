import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class RootErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '30px', background: '#0a0000', color: '#ff6b6b', minHeight: '100vh', fontFamily: 'monospace' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold' }}>🚨 Error al Renderizar AuraMaster</h1>
          <p style={{ marginTop: '10px', fontSize: '14px', color: '#ffb3b3' }}>{this.state.error?.message}</p>
          <pre style={{ marginTop: '20px', background: '#1f0000', padding: '15px', borderRadius: '8px', fontSize: '12px', overflow: 'auto', border: '1px solid #500' }}>
            {this.state.error?.stack}
            {'\n\nComponent Stack:\n'}
            {this.state.errorInfo?.componentStack}
          </pre>
          <button 
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            style={{ marginTop: '20px', padding: '10px 20px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Limpiar Caché Local y Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);