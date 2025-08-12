import { useEffect, useState } from "react";

interface DeviceInfo {
  isIOS: boolean;
  isOldIOS: boolean;
  browser: string;
  version: string;
}

export function useDeviceDetection(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    isIOS: false,
    isOldIOS: false,
    browser: "unknown",
    version: "unknown",
  });

  useEffect(() => {
    const userAgent = navigator.userAgent;

    // Detectar iOS
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);

    // Detectar versão do iOS
    let isOldIOS = false;
    if (isIOS) {
      const match = userAgent.match(/OS (\d+)_(\d+)/);
      if (match) {
        const majorVersion = parseInt(match[1]);
        // Considerar iOS < 14 como versões antigas que podem ter problemas
        isOldIOS = majorVersion < 14;
      }
    }

    // Detectar browser
    let browser = "unknown";
    if (/Safari/.test(userAgent) && !/Chrome/.test(userAgent)) {
      browser = "safari";
    } else if (/Chrome/.test(userAgent)) {
      browser = "chrome";
    } else if (/Firefox/.test(userAgent)) {
      browser = "firefox";
    }

    setDeviceInfo({
      isIOS,
      isOldIOS,
      browser,
      version: userAgent,
    });

    // Log para debug em desenvolvimento
    if (process.env.NODE_ENV === "development") {
      console.log("Device Detection:", {
        isIOS,
        isOldIOS,
        browser,
        userAgent,
      });
    }
  }, []);

  return deviceInfo;
}
