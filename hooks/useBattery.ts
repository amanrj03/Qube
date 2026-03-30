'use client';
import { useState, useEffect } from 'react';

export interface BatteryInfo {
  level: number;
  charging: boolean;
  supported: boolean;
}

export function useBattery(): BatteryInfo {
  const [info, setInfo] = useState<BatteryInfo>({ level: 100, charging: false, supported: false });

  useEffect(() => {
    if (typeof navigator === 'undefined' || !(navigator as any).getBattery) return;

    let battery: any = null;

    const update = () => {
      if (!battery) return;
      const level = Math.round(battery.level * 100);
      // On desktop Chrome, getBattery always returns level=1.0 and charging=true
      // We detect this and hide the indicator (not useful info)
      const isDesktopFallback = level === 100 && battery.charging && battery.chargingTime === 0 && battery.dischargingTime === Infinity;
      setInfo({
        level,
        charging: battery.charging,
        supported: !isDesktopFallback,
      });
    };

    (navigator as any).getBattery().then((b: any) => {
      battery = b;
      update();
      b.addEventListener('levelchange', update);
      b.addEventListener('chargingchange', update);
      b.addEventListener('chargingtimechange', update);
      b.addEventListener('dischargingtimechange', update);
    }).catch(() => {});

    return () => {
      if (battery) {
        battery.removeEventListener('levelchange', update);
        battery.removeEventListener('chargingchange', update);
        battery.removeEventListener('chargingtimechange', update);
        battery.removeEventListener('dischargingtimechange', update);
      }
    };
  }, []);

  return info;
}
