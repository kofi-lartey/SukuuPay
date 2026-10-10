import React, { useState, useEffect } from 'react';
import {
  LoadingScreen,
  LoadingScreenProvider,
} from '@/components/loading';
import {
  useLoadingScreen,
  useAsyncLoadingScreen,
  loadingScreenManager,
} from '@/hooks/useLoadingScreen';

export function LoadingExamples() {
  const [activeDemo, setActiveDemo] = useState<'basic' | 'hook' | 'async' | 'manager'>('basic');

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold text-ink">Loading Animation Examples</h1>

      <div className="flex gap-4 flex-wrap">
        {(['basic', 'hook', 'async', 'manager'] as const).map((demo) => (
          <button
            key={demo}
            onClick={() => setActiveDemo(demo)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeDemo === demo
                ? 'bg-brand-700 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {demo.charAt(0).toUpperCase() + demo.slice(1)}
          </button>
        ))}
      </div>

      <div className="border rounded-lg p-6 bg-white">
        {activeDemo === 'basic' && <BasicExample />}
        {activeDemo === 'hook' && <HookExample />}
        {activeDemo === 'async' && <AsyncExample />}
        {activeDemo === 'manager' && <ManagerExample />}
      </div>
    </div>
  );
}

function BasicExample() {
  const [showLoading, setShowLoading] = useState(false);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Basic LoadingScreen Component</h2>
      <p className="text-gray-600">
        Direct component usage with variant selection.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {(['pulse', 'rotate', 'morph', 'breathe', 'orbit', 'wave'] as const).map((variant) => (
          <div key={variant} className="p-4 border rounded-lg text-center">
            <LoadingScreen
              variant={variant}
              logoSrc="/sukuupay-logo.png"
              size={80}
              minDisplayTime={2000}
              onComplete={() => console.log(`${variant} complete`)}
            />
            <p className="mt-2 text-sm font-medium capitalize">{variant}</p>
          </div>
        ))}
      </div>

      <button
        onClick={() => setShowLoading(true)}
        className="px-6 py-3 bg-brand-700 text-white rounded-lg hover:bg-brand-800 transition-colors"
      >
        Trigger Full Screen Loading (Pulse)
      </button>

      {showLoading && (
        <LoadingScreenProvider
          variant="pulse"
          minDisplayTime={1500}
          onComplete={() => setShowLoading(false)}
        >
          <div>App Content</div>
        </LoadingScreenProvider>
      )}
    </div>
  );
}

function HookExample() {
  const loading = useLoadingScreen({
    variant: 'morph',
    minDisplayTime: 800,
    onComplete: () => console.log('Hook loading complete'),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">useLoadingScreen Hook</h2>
      <p className="text-gray-600">Programmatic control with full state management.</p>

      <div className="flex flex-wrap gap-4">
        {(['pulse', 'rotate', 'morph', 'breathe', 'orbit', 'wave'] as const).map((variant) => (
          <button
            key={variant}
            onClick={() => loading.show({ variant })}
            disabled={loading.isLoading}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              loading.variant === variant && loading.isLoading
                ? 'bg-brand-700 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50'
            }`}
          >
            {variant.charAt(0).toUpperCase() + variant.slice(1)}
          </button>
        ))}
      </div>

      <div className="p-4 bg-gray-50 rounded-lg text-sm font-mono">
        Status: {loading.isLoading ? 'Loading' : 'Idle'}
        {loading.isTransitioning && ' (Transitioning)'}
        <br />
        Current Variant: {loading.variant}
      </div>

      <LoadingScreen
        variant={loading.variant}
        logoSrc={loading.logoSrc}
        logoAlt={loading.logoAlt}
        size={loading.size}
        backgroundColor={loading.backgroundColor}
      />
    </div>
  );
}

function AsyncExample() {
  const mockApiCall = async (delay = 2000) => {
    await new Promise((resolve) => setTimeout(resolve, delay));
    return { success: true, data: 'Sample response' };
  };

  const asyncLoading = useAsyncLoadingScreen(mockApiCall, {
    variant: 'breathe',
    minDisplayTime: 500,
  });

  const [result, setResult] = useState(null);

  const handleExecute = async () => {
    setResult(null);
    try {
      const data = await asyncLoading.execute();
      setResult(data);
    } catch (error) {
      setResult({ error: error.message });
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">useAsyncLoadingScreen Hook</h2>
      <p className="text-gray-600">Automatic loading state for async operations.</p>

      <div className="flex flex-wrap gap-4">
        <button
          onClick={handleExecute}
          disabled={asyncLoading.isLoading}
          className="px-6 py-3 bg-brand-700 text-white rounded-lg hover:bg-brand-800 disabled:opacity-50 transition-colors"
        >
          {asyncLoading.isLoading ? 'Loading...' : 'Execute Async Call (2s)'}
        </button>

        <button
          onClick={() => asyncLoading.show({ variant: 'orbit' })}
          disabled={asyncLoading.isLoading}
          className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          Show Orbit (Manual)
        </button>
      </div>

      <div className="p-4 bg-gray-50 rounded-lg text-sm font-mono">
        Status: {asyncLoading.isLoading ? 'Loading' : 'Idle'}
        <br />
        Variant: {asyncLoading.variant}
      </div>

      {result && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm">
          <pre className="font-mono">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}

      <LoadingScreen
        variant={asyncLoading.variant}
        logoSrc={asyncLoading.logoSrc}
        logoAlt={asyncLoading.logoAlt}
        size={asyncLoading.size}
        backgroundColor={asyncLoading.backgroundColor}
      />
    </div>
  );
}

function ManagerExample() {
  const [managerLog, setManagerLog] = useState([]);

  const log = (message) => {
    setManagerLog((prev) => [...prev.slice(-9), `${new Date().toLocaleTimeString()} - ${message}`]);
  };

  const showWithVariant = (variant) => {
    log(`Showing ${variant} via manager`);
    loadingScreenManager.show({ variant, minDisplayTime: 1000 });
  };

  const hideManager = () => {
    log('Hiding via manager');
    loadingScreenManager.hide();
  };

  useEffect(() => {
    loadingScreenManager.setInstance({
      show: (opts) => log(`Manager show called with ${opts.variant}`),
      hide: () => log('Manager hide called'),
    });
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Global loadingScreenManager</h2>
      <p className="text-gray-600">Cross-component control without prop drilling.</p>

      <div className="flex flex-wrap gap-2">
        {(['pulse', 'rotate', 'morph', 'breathe', 'orbit', 'wave'] as const).map((variant) => (
          <button
            key={variant}
            onClick={() => showWithVariant(variant)}
            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
          >
            {variant}
          </button>
        ))}
        <button
          onClick={hideManager}
          className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
        >
          Hide
        </button>
      </div>

      <div className="p-4 bg-gray-900 text-green-400 font-mono text-xs rounded-lg max-h-40 overflow-auto">
        {managerLog.map((entry, i) => (
          <div key={i}>{entry}</div>
        ))}
        {managerLog.length === 0 && <div className="text-gray-500">No activity yet</div>}
      </div>

      <LoadingScreen
        variant="pulse"
        logoSrc="/sukuupay-logo.png"
        size={80}
      />
    </div>
  );
}

export default LoadingExamples;