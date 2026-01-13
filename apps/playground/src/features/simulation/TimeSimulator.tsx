/**
 * Time Simulator Component
 * Allows users to advance time to test subscription renewals and expirations
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Clock,
  FastForward,
  RotateCcw,
  Play,
  Pause,
  ChevronUp,
  ChevronDown,
  Timer,
  Square,
} from 'lucide-react';
import { useConfigStore } from '../../stores/config.store';
import { processSubscriptionLifecycle, DEFAULT_LIFECYCLE_CONFIG } from '../../services/subscription-lifecycle.engine';

interface TimeSimulatorProps {
  onTimeAdvanced?: () => void;
  compact?: boolean;
}

export function TimeSimulator({ onTimeAdvanced, compact = false }: TimeSimulatorProps) {
  const { t } = useTranslation('simulation');
  const {
    timeSimulation,
    enableTimeSimulation,
    disableTimeSimulation,
    advanceTime,
    setSimulatedDate,
    getCurrentTime,
    billing,
    isInitialized,
  } = useConfigStore();

  const [isExpanded, setIsExpanded] = useState(!compact);
  const [customDays, setCustomDays] = useState('30');
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [autoPlaySpeed, setAutoPlaySpeed] = useState(5); // seconds per day
  const [isProcessing, setIsProcessing] = useState(false);
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentTime = getCurrentTime();
  const realTime = new Date();

  // Process subscription lifecycle after time advances
  const runLifecycleProcessing = useCallback(async () => {
    if (!billing || !isInitialized || !timeSimulation.enabled) return;

    setIsProcessing(true);
    try {
      const newTime = getCurrentTime();
      await processSubscriptionLifecycle(billing, newTime, DEFAULT_LIFECYCLE_CONFIG);
    } catch (error) {
      console.error('Error processing lifecycle:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [billing, isInitialized, timeSimulation.enabled, getCurrentTime]);

  const handleAdvanceTime = async (days: number) => {
    advanceTime(days);
    await runLifecycleProcessing();
    onTimeAdvanced?.();
  };

  // Auto-play effect - advances time by 1 day at the configured interval
  useEffect(() => {
    if (isAutoPlaying && timeSimulation.enabled && !isProcessing) {
      autoPlayRef.current = setInterval(async () => {
        advanceTime(1);
        await runLifecycleProcessing();
        onTimeAdvanced?.();
      }, autoPlaySpeed * 1000);
    }

    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
        autoPlayRef.current = null;
      }
    };
  }, [isAutoPlaying, timeSimulation.enabled, autoPlaySpeed, advanceTime, onTimeAdvanced, isProcessing, runLifecycleProcessing]);

  // Stop auto-play when simulation is disabled
  useEffect(() => {
    if (!timeSimulation.enabled && isAutoPlaying) {
      setIsAutoPlaying(false);
    }
  }, [timeSimulation.enabled, isAutoPlaying]);

  const handleToggleAutoPlay = () => {
    if (!timeSimulation.enabled) {
      // If simulation is not enabled, just enable it and open the popover
      // Don't start auto-play immediately - let user choose
      enableTimeSimulation();
      if (compact) {
        setIsExpanded(true);
      }
      return;
    }

    const newState = !isAutoPlaying;
    setIsAutoPlaying(newState);
    // Close dropdown when starting auto-play in compact mode
    if (newState && compact) {
      setIsExpanded(false);
    }
  };

  const handleResetToNow = () => {
    setSimulatedDate(new Date());
    onTimeAdvanced?.();
  };

  const handleToggleSimulation = () => {
    if (timeSimulation.enabled) {
      disableTimeSimulation();
    } else {
      enableTimeSimulation();
    }
    onTimeAdvanced?.();
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const daysDiff = timeSimulation.enabled && timeSimulation.simulatedDate
    ? Math.floor((currentTime.getTime() - realTime.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Ref for click outside handling
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!compact || !isExpanded) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [compact, isExpanded]);

  // Compact mode wrapper with dropdown
  if (compact) {
    return (
      <div className="relative flex items-center gap-1" ref={dropdownRef}>
        {/* Main trigger button - shows date/time */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
            isAutoPlaying
              ? 'bg-green-900/50 border border-green-500/50 text-green-300'
              : timeSimulation.enabled
                ? 'bg-purple-900/50 border border-purple-500/50 text-purple-300 hover:bg-purple-900/60'
                : 'bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700'
          }`}
        >
          {isAutoPlaying ? (
            <Timer className="h-4 w-4 animate-spin" />
          ) : (
            <Clock className="h-4 w-4" />
          )}
          {timeSimulation.enabled ? (
            <span className="font-mono text-xs">
              {formatDate(currentTime)}
              {daysDiff !== 0 && (
                <span className={`ml-1 ${isAutoPlaying ? 'text-green-400' : 'text-purple-400'}`}>
                  ({daysDiff > 0 ? '+' : ''}{daysDiff}d)
                </span>
              )}
            </span>
          ) : (
            <span>{t('timeSimulator.realTime', 'Real Time')}</span>
          )}
          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {/* Quick control buttons in header */}
        {timeSimulation.enabled && (
          <div className="flex items-center gap-1">
            {/* Play/Pause button */}
            <button
              type="button"
              onClick={handleToggleAutoPlay}
              className={`p-1.5 rounded-lg transition-colors ${
                isAutoPlaying
                  ? 'bg-red-900/50 border border-red-500/50 text-red-300 hover:bg-red-900/60'
                  : 'bg-green-900/50 border border-green-500/50 text-green-300 hover:bg-green-900/60'
              }`}
              title={isAutoPlaying ? t('timeSimulator.pause', 'Pause') : t('timeSimulator.play', 'Play')}
            >
              {isAutoPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>

            {/* Reset button */}
            <button
              type="button"
              onClick={handleResetToNow}
              className="p-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700 transition-colors"
              title={t('timeSimulator.resetToNow', 'Reset to now')}
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Dropdown panel */}
        {isExpanded && (
          <div
            className="absolute top-full left-0 mt-2 w-80 rounded-lg border shadow-2xl z-50"
            style={{
              backgroundColor: '#1a1a2e',
              borderColor: timeSimulation.enabled ? 'rgba(168, 85, 247, 0.5)' : 'var(--color-border)',
            }}
          >
            {renderContent()}
          </div>
        )}
      </div>
    );
  }

  // Non-compact (inline) version
  return (
    <div
      className="rounded-lg border"
      style={{
        backgroundColor: timeSimulation.enabled ? '#1e1b4b' : 'var(--color-surface)',
        borderColor: timeSimulation.enabled ? 'rgba(168, 85, 247, 0.5)' : 'var(--color-border)',
      }}
    >
      {renderContent()}
    </div>
  );

  // Extracted content renderer to avoid duplication
  function renderContent() {
    return (
      <>
      {/* Header */}
      <div className="p-3 flex items-center justify-between border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-2">
          {isAutoPlaying ? (
            <Timer className="h-5 w-5 text-green-400 animate-spin" />
          ) : (
            <Clock className={`h-5 w-5 ${timeSimulation.enabled ? 'text-purple-400' : 'text-gray-400'}`} />
          )}
          <span className="font-medium" style={{ color: 'var(--color-text)' }}>
            {t('timeSimulator.title', 'Time Simulator')}
          </span>
          {isAutoPlaying ? (
            <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-300 animate-pulse">
              {t('timeSimulator.autoPlaying', 'Auto-Playing')}
            </span>
          ) : timeSimulation.enabled ? (
            <span className="px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-300">
              {t('timeSimulator.active', 'Active')}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {/* Auto-play button */}
          <button
            type="button"
            onClick={handleToggleAutoPlay}
            className={`p-1.5 rounded ${
              isAutoPlaying
                ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
            title={isAutoPlaying
              ? t('timeSimulator.stopAutoPlay', 'Stop Auto-Play')
              : t('timeSimulator.startAutoPlay', 'Start Auto-Play')}
          >
            {isAutoPlaying ? <Square className="h-4 w-4" /> : <Timer className="h-4 w-4" />}
          </button>
          {/* Enable/disable simulation */}
          <button
            type="button"
            onClick={handleToggleSimulation}
            className={`p-1.5 rounded ${
              timeSimulation.enabled
                ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
            title={timeSimulation.enabled ? t('timeSimulator.disable', 'Disable') : t('timeSimulator.enable', 'Enable')}
            disabled={isAutoPlaying}
          >
            {timeSimulation.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          {compact && (
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="p-1.5 rounded bg-gray-700 text-gray-400 hover:bg-gray-600"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Current Time Display */}
      <div className="p-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {/* Simulated Time */}
          <div className="p-2 rounded-lg bg-black/20">
            <div className="text-xs text-gray-400 mb-1">
              {t('timeSimulator.simulatedTime', 'Simulated Time')}
            </div>
            <div className="font-mono" style={{ color: timeSimulation.enabled ? '#a855f7' : 'var(--color-text)' }}>
              {formatDate(currentTime)}
            </div>
            <div className="text-xs font-mono text-gray-500">
              {formatTime(currentTime)}
            </div>
          </div>

          {/* Real Time */}
          <div className="p-2 rounded-lg bg-black/20">
            <div className="text-xs text-gray-400 mb-1">
              {t('timeSimulator.realTime', 'Real Time')}
            </div>
            <div className="font-mono text-gray-400">
              {formatDate(realTime)}
            </div>
            <div className="text-xs font-mono text-gray-500">
              {formatTime(realTime)}
            </div>
          </div>
        </div>

        {/* Difference indicator */}
        {timeSimulation.enabled && daysDiff !== 0 && (
          <div className={`text-center py-2 px-3 rounded-lg border ${
            isAutoPlaying
              ? 'bg-green-500/10 border-green-500/20'
              : 'bg-purple-500/10 border-purple-500/20'
          }`}>
            <span className={`text-sm ${isAutoPlaying ? 'text-green-300' : 'text-purple-300'}`}>
              {daysDiff > 0 ? '+' : ''}{daysDiff} {t('timeSimulator.daysFromNow', 'days from now')}
            </span>
          </div>
        )}

        {/* Auto-play Controls */}
        {timeSimulation.enabled && (
          <div className={`p-3 rounded-lg border ${
            isAutoPlaying
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-black/20 border-transparent'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                {t('timeSimulator.autoPlaySection', 'Auto-Play Mode')}
              </span>
              {isAutoPlaying && (
                <span className="text-xs text-green-400">
                  {t('timeSimulator.advancingEvery', 'Advancing every')} {autoPlaySpeed}s
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleAutoPlay}
                className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors ${
                  isAutoPlaying
                    ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30'
                    : 'bg-green-500/20 text-green-300 hover:bg-green-500/30 border border-green-500/30'
                }`}
              >
                {isAutoPlaying ? (
                  <>
                    <Square className="h-4 w-4" />
                    {t('timeSimulator.stop', 'Stop')}
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    {t('timeSimulator.startAutoPlay', 'Start Auto-Play')}
                  </>
                )}
              </button>
            </div>

            {/* Speed control */}
            <div className="mt-3">
              <label className="text-xs text-gray-400 block mb-1">
                {t('timeSimulator.speedLabel', 'Speed: 1 day every')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={autoPlaySpeed}
                  onChange={(e) => setAutoPlaySpeed(parseInt(e.target.value, 10))}
                  className="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, ${isAutoPlaying ? '#22c55e' : '#6b7280'} 0%, ${isAutoPlaying ? '#22c55e' : '#6b7280'} ${(autoPlaySpeed - 1) / 9 * 100}%, #374151 ${(autoPlaySpeed - 1) / 9 * 100}%, #374151 100%)`
                  }}
                  disabled={isAutoPlaying}
                />
                <span className="text-sm font-mono w-16 text-right" style={{ color: 'var(--color-text-secondary)' }}>
                  {autoPlaySpeed} {t('timeSimulator.seconds', 'sec')}
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{t('timeSimulator.fast', 'Fast')}</span>
                <span>{t('timeSimulator.slow', 'Slow')}</span>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions - disabled during auto-play */}
        {timeSimulation.enabled && !isAutoPlaying && (
          <>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleAdvanceTime(1)}
                className="flex-1 btn btn-secondary py-1.5 text-sm"
              >
                <FastForward className="h-3 w-3" />
                +1 {t('timeSimulator.day', 'day')}
              </button>
              <button
                type="button"
                onClick={() => handleAdvanceTime(7)}
                className="flex-1 btn btn-secondary py-1.5 text-sm"
              >
                <FastForward className="h-3 w-3" />
                +7 {t('timeSimulator.days', 'days')}
              </button>
              <button
                type="button"
                onClick={() => handleAdvanceTime(30)}
                className="flex-1 btn btn-secondary py-1.5 text-sm"
              >
                <FastForward className="h-3 w-3" />
                +30 {t('timeSimulator.days', 'days')}
              </button>
            </div>

            {/* Custom advance */}
            <div className="flex gap-2">
              <input
                type="number"
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
                className="flex-1 input py-1.5 text-sm"
                placeholder={t('timeSimulator.customDays', 'Custom days')}
                min="1"
              />
              <button
                type="button"
                onClick={() => handleAdvanceTime(parseInt(customDays, 10) || 0)}
                className="btn btn-primary py-1.5 text-sm"
                disabled={!customDays || parseInt(customDays, 10) <= 0}
              >
                <FastForward className="h-3 w-3" />
                {t('timeSimulator.advance', 'Advance')}
              </button>
            </div>

            {/* Date picker */}
            <div className="flex gap-2">
              <input
                type="date"
                value={currentTime.toISOString().split('T')[0]}
                onChange={(e) => {
                  const newDate = new Date(e.target.value);
                  // Preserve the time from current simulated date
                  newDate.setHours(currentTime.getHours(), currentTime.getMinutes());
                  setSimulatedDate(newDate);
                  onTimeAdvanced?.();
                }}
                className="flex-1 input py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={handleResetToNow}
                className="btn btn-secondary py-1.5 text-sm"
                title={t('timeSimulator.resetToNow', 'Reset to now')}
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            </div>
          </>
        )}

        {/* Help text */}
        <p className="text-xs text-gray-500">
          {isAutoPlaying
            ? t('timeSimulator.helpAutoPlay', 'Time is advancing automatically. Watch how subscriptions renew, expire, and billing cycles progress.')
            : timeSimulation.enabled
              ? t('timeSimulator.helpEnabled', 'Advance time to test subscription renewals, trial expirations, and billing cycles.')
              : t('timeSimulator.helpDisabled', 'Enable time simulation to test how subscriptions behave over time.')}
        </p>
      </div>
      </>
    );
  }
}
