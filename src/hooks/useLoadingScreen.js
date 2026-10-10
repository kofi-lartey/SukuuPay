import { useState, useCallback, useEffect, useRef } from 'react';

export function useLoadingScreen(options = {}) {
  const {
    variant = 'pulse',
    minDisplayTime = 800,
    logoSrc = '/sukuupay-logo.png',
    logoAlt = 'SukuuPay',
    size = 120,
    backgroundColor = '#ffffff',
    onComplete,
  } = options;

  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const startTimeRef = useRef(Date.now());
  const timeoutRef = useRef(null);

  const show = useCallback((newOptions = {}) => {
    const mergedOptions = { ...options, ...newOptions };
    const elapsed = Date.now() - startTimeRef.current;
    const remaining = Math.max(0, mergedOptions.minDisplayTime - elapsed);

    setIsLoading(true);
    setIsTransitioning(false);
    startTimeRef.current = Date.now();

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setIsLoading(false);
        mergedOptions.onComplete?.();
      }, 600);
    }, remaining);
  }, [options]);

  const hide = useCallback((immediate = false) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (immediate) {
      setIsLoading(false);
      setIsTransitioning(false);
      options.onComplete?.();
    } else {
      setIsTransitioning(true);
      setTimeout(() => {
        setIsLoading(false);
        options.onComplete?.();
      }, 600);
    }
  }, [options]);

  const toggle = useCallback(() => {
    if (isLoading) {
      hide();
    } else {
      show();
    }
  }, [isLoading, hide, show]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    isLoading,
    isTransitioning,
    show,
    hide,
    toggle,
    variant,
    logoSrc,
    logoAlt,
    size,
    backgroundColor,
  };
}

export function useAsyncLoadingScreen(asyncFn, options = {}) {
  const loading = useLoadingScreen(options);

  const execute = useCallback(async (...args) => {
    loading.show();
    try {
      const result = await asyncFn(...args);
      loading.hide();
      return result;
    } catch (error) {
      loading.hide();
      throw error;
    }
  }, [asyncFn, loading]);

  return {
    ...loading,
    execute,
  };
}

export function useRouteLoadingScreen(router, options = {}) {
  const loading = useLoadingScreen(options);
  const isNavigatingRef = useRef(false);

  useEffect(() => {
    const unlisten = router?.subscribe?.((state) => {
      if (state.delta > 0 && !isNavigatingRef.current) {
        isNavigatingRef.current = true;
        loading.show();
      } else if (isNavigatingRef.current) {
        isNavigatingRef.current = false;
        loading.hide();
      }
    });

    return unlisten;
  }, [router, loading]);

  return loading;
}

export function createLoadingScreenManager(defaultOptions = {}) {
  let currentInstance = null;
  let currentOptions = defaultOptions;

  return {
    show(options = {}) {
      currentOptions = { ...currentOptions, ...options };
      if (currentInstance) {
        currentInstance.show(currentOptions);
      }
      return this;
    },

    hide(immediate = false) {
      if (currentInstance) {
        currentInstance.hide(immediate);
      }
      return this;
    },

    setInstance(instance) {
      currentInstance = instance;
    },

    getOptions() {
      return currentOptions;
    },

    updateOptions(options) {
      currentOptions = { ...currentOptions, ...options };
      return this;
    },
  };
}

export const loadingScreenManager = createLoadingScreenManager();

export default useLoadingScreen;