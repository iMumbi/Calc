/**
 * store.js — State management & persistence.
 *
 * Owns all application state that must survive interactions or reloads:
 *   - memory register (MC / MR / M+ / M-)
 *   - calculation history
 *   - angle mode (DEG / RAD)
 *   - theme (light / dark)
 *
 * Persists to localStorage with graceful degradation: if storage is unavailable
 * (private mode, file:// restrictions) the app still works in-memory and never
 * throws. Presentation code subscribes via onChange to stay in sync.
 */
(function () {
  "use strict";

  const STORAGE_KEY = "calculator.state.v1";
  const MAX_HISTORY = 50;

  const defaults = () => ({
    memory: 0,
    history: [], // [{ expression, result, ts }]
    angleMode: "DEG",
    theme: "dark",
  });

  function safeLoad() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaults();
      const parsed = JSON.parse(raw);
      return { ...defaults(), ...parsed };
    } catch {
      return defaults();
    }
  }

  function safeSave(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable — continue in-memory */
    }
  }

  const Store = {
    _state: safeLoad(),
    _listeners: new Set(),

    getState() {
      return this._state;
    },

    onChange(listener) {
      this._listeners.add(listener);
      return () => this._listeners.delete(listener);
    },

    _commit() {
      safeSave(this._state);
      this._listeners.forEach((fn) => fn(this._state));
    },

    // --- Memory functions (MC / MR / M+ / M-) ------------------------------
    memoryClear() {
      this._state.memory = 0;
      this._commit();
    },
    memoryRecall() {
      return this._state.memory;
    },
    memoryAdd(value) {
      this._state.memory += value;
      this._commit();
    },
    memorySubtract(value) {
      this._state.memory -= value;
      this._commit();
    },
    hasMemory() {
      return this._state.memory !== 0;
    },

    // --- History -----------------------------------------------------------
    addHistory(expression, result) {
      this._state.history.unshift({ expression, result, ts: Date.now() });
      if (this._state.history.length > MAX_HISTORY) {
        this._state.history.length = MAX_HISTORY;
      }
      this._commit();
    },
    clearHistory() {
      this._state.history = [];
      this._commit();
    },

    // --- Angle mode --------------------------------------------------------
    toggleAngleMode() {
      this._state.angleMode = this._state.angleMode === "DEG" ? "RAD" : "DEG";
      this._commit();
      return this._state.angleMode;
    },

    // --- Theme -------------------------------------------------------------
    toggleTheme() {
      this._state.theme = this._state.theme === "dark" ? "light" : "dark";
      this._commit();
      return this._state.theme;
    },
    setTheme(theme) {
      this._state.theme = theme === "light" ? "light" : "dark";
      this._commit();
    },
  };

  if (typeof window !== "undefined") window.Store = Store;
  if (typeof module === "object" && module.exports) module.exports = Store;
})();
