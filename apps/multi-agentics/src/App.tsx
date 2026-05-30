import { Component, lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import { Spinner } from './components/ui'

const MissionControl = lazy(() => import('./pages/MissionControlPage'))
const ArchitecturePage = lazy(() => import('./pages/ArchitecturePage'))
const TeamsPage = lazy(() => import('./pages/TeamsPage'))
const KnowledgePage = lazy(() => import('./pages/KnowledgePage'))
const ToolsPage = lazy(() => import('./pages/ToolsPage'))
const ObservabilityPage = lazy(() => import('./pages/ObservabilityPage'))
const GovernancePage = lazy(() => import('./pages/GovernancePage'))
const McpPage = lazy(() => import('./pages/McpPage'))
const ProductionPage = lazy(() => import('./pages/ProductionPage'))
const RunDetailPage = lazy(() => import('./pages/RunDetailPage'))

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="grid place-items-center min-h-screen p-8">
          <div className="card max-w-md text-center">
            <h1 className="text-lg font-bold mb-2">Something went wrong</h1>
            <p className="text-sm text-[var(--text-muted)] mb-4">{this.state.error.message}</p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function Loading() {
  return (
    <div className="grid place-items-center py-24">
      <Spinner size={28} />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route
              path="/"
              element={
                <Suspense fallback={<Loading />}>
                  <MissionControl />
                </Suspense>
              }
            />
            <Route path="/architecture" element={<Suspense fallback={<Loading />}><ArchitecturePage /></Suspense>} />
            <Route path="/teams" element={<Suspense fallback={<Loading />}><TeamsPage /></Suspense>} />
            <Route path="/knowledge" element={<Suspense fallback={<Loading />}><KnowledgePage /></Suspense>} />
            <Route path="/tools" element={<Suspense fallback={<Loading />}><ToolsPage /></Suspense>} />
            <Route path="/observability" element={<Suspense fallback={<Loading />}><ObservabilityPage /></Suspense>} />
            <Route path="/governance" element={<Suspense fallback={<Loading />}><GovernancePage /></Suspense>} />
            <Route path="/mcp" element={<Suspense fallback={<Loading />}><McpPage /></Suspense>} />
            <Route path="/production" element={<Suspense fallback={<Loading />}><ProductionPage /></Suspense>} />
            <Route path="/runs/:id" element={<Suspense fallback={<Loading />}><RunDetailPage /></Suspense>} />
            <Route path="*" element={<div className="card">Not found.</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
