/**
 * 🎡 Wheel Service
 * Manages daily wheel spin resets and limits
 */

import { prisma } from '../prisma'

/**
 * Kullanıcının çark haklarını kontrol eder ve gerekirse sıfırlar
 * @param userId Kullanıcı ID'si
 * @param wheelResetTime Sıfırlama zamanı (HH:mm formatında), varsayılan "00:00"
 * @param dailyWheelSpins Günlük çark hakkı, varsayılan 3
 * @returns { dailySpinsLeft, wasReset } - Güncel çark hakkı ve sıfırlanıp sıfırlanmadığı
 */
export async function checkAndResetWheelSpins(
  userId: string,
  wheelResetTime: string = "00:00",
  dailyWheelSpins: number = 3
): Promise<{ dailySpinsLeft: number; wasReset: boolean } | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        telegramId: true,
        firstName: true,
        telegramUsername: true,
        dailySpinsLeft: true,
        lastSpinReset: true,
      },
    });

    if (!user) return null;

    // wheelResetTime'ı parse et (HH:mm formatında) - Bu Türkiye saati
    const [wheelResetHour, wheelResetMinute] = wheelResetTime.split(':').map(num => parseInt(num) || 0);

    const now = new Date(); // UTC
    const lastReset = user.lastSpinReset;

    // Türkiye'deki bugünün tarihini al
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(now);
    const values: Record<string, number> = {};

    for (const part of parts) {
      if (part.type !== 'literal') {
        values[part.type] = Number.parseInt(part.value);
      }
    }

    // Türkiye'deki şu anki saat ve dakika
    const currentTurkeyHour = values.hour;
    const currentTurkeyMinute = values.minute;
    const currentTurkeyTimeInMinutes = currentTurkeyHour * 60 + currentTurkeyMinute;
    const resetTimeInMinutes = wheelResetHour * 60 + wheelResetMinute;

    // Bugünün reset zamanını UTC olarak hesapla
    const testDate = new Date(Date.UTC(values.year, values.month - 1, values.day, 12, 0, 0));
    const turkeyHourStr = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Istanbul',
      hour: '2-digit',
      hour12: false
    }).format(testDate);
    const offset = Number.parseInt(turkeyHourStr) - 12;

    // Bugünün reset zamanı (Türkiye saatinde wheelResetHour:wheelResetMinute = UTC'de ?)
    const todayResetTimeUTC = new Date(Date.UTC(
      values.year,
      values.month - 1,
      values.day,
      wheelResetHour - offset,
      wheelResetMinute,
      0,
      0
    ));

    // Dünün reset zamanı
    const yesterdayResetTimeUTC = new Date(todayResetTimeUTC.getTime() - 24 * 60 * 60 * 1000);

    // Reset gerekiyor mu?
    let shouldReset = false;

    if (!lastReset) {
      shouldReset = true;
    } else {
      // Şu anki Türkiye saati reset zamanından önce mi?
      if (currentTurkeyTimeInMinutes < resetTimeInMinutes) {
        // Dünün reset zamanından sonra mı?
        shouldReset = lastReset < yesterdayResetTimeUTC;
      } else {
        // Bugünün reset zamanından sonra mı?
        shouldReset = lastReset < todayResetTimeUTC;
      }
    }

    if (shouldReset) {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          dailySpinsLeft: dailyWheelSpins,
          lastSpinReset: now,
        },
        select: {
          dailySpinsLeft: true
        }
      });

      console.log(`🔄 Çark hakları sıfırlandı: User ${userId} - ${dailyWheelSpins} hak (Sıfırlama zamanı: ${wheelResetTime})`);

      return { dailySpinsLeft: updatedUser.dailySpinsLeft, wasReset: true };
    }

    return { dailySpinsLeft: user.dailySpinsLeft, wasReset: false };
  } catch (error) {
    console.error("Wheel reset check error:", error);
    return null;
  }
}
