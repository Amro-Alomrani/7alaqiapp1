import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Component, type ReactNode, type ErrorInfo } from 'react'
import './index.css'
import App from './App.tsx'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App rendering failed', error, info.componentStack);
}
  render() {
    if (this.state.error) {
      return (
        <div role="alert" dir="rtl" style={{ padding: 28, color: '#fff', background: '#100d15', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', display: 'grid', placeContent: 'center', textAlign: 'center' }}>
          <h1 style={{ color: '#f4b72f', fontSize: 24, marginBottom: 10 }}>واجه التطبيق مشكلة مؤقتة</h1>
          <p style={{ color: '#c7c1cc', maxWidth: 360, lineHeight: 1.7, margin: '0 auto 22px' }}>
            أعد المحاولة، أو ارجع إلى بداية التطبيق. إذا تكررت المشكلة، أرسل لقطة للشاشة للدعم.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            <button onClick={() => window.location.reload()} style={{ padding: '12px 20px', borderRadius: 12, background: '#f4b72f', color: '#17121b', fontWeight: 700, border: 0 }}>
              إعادة المحاولة
            </button>
            <button onClick={() => { window.location.hash = '#/intro'; window.location.reload(); }} style={{ padding: '12px 20px', borderRadius: 12, background: '#211a29', color: '#fff', fontWeight: 700, border: '1px solid #403349' }}>
              بداية التطبيق
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
