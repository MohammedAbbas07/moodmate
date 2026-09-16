import React, { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('MoodMate ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="relative min-h-screen bg-[#05060a] text-white flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden">
          {/* Ambient Glows */}
          <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-purple-600/15 blur-[120px] pointer-events-none" />
          <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-indigo-600/15 blur-[120px] pointer-events-none" />

          {/* Fallback Glass Card */}
          <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/[0.08] bg-[#07080c]/80 p-8 backdrop-blur-2xl shadow-2xl">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-purple-500/30 bg-purple-500/10 text-purple-400 shadow-inner">
              <AlertTriangle size={32} className="text-purple-300" />
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Something went wrong
            </h1>

            <p className="mt-3 text-sm leading-relaxed text-white/60">
              We hit an unexpected error. Please refresh the page to continue.
            </p>

            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={this.handleRefresh}
                className="flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition hover:brightness-110 active:scale-95 cursor-pointer"
              >
                <RefreshCw size={16} />
                <span>Refresh Page</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
