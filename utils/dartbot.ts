// utils/dartbot.ts
import { getCheckoutGuide } from "./checkouts";

type ThrowResult = {
  score: number;
  multiplier: number;
};

// Apufunktio: Palauttaa satunnaisen luvun väliltä min-max
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// Botin "aivot" - Päättää heiton tuloksen
export const calculateBotThrow = (
  currentScore: number, 
  skillLevel: number, // 1-100
  gameMode: 'x01' | 'rtc',
  rtcTarget: number = 1
): ThrowResult => {
  
  // --- ROUND THE CLOCK LOGIIKKA ---
  if (gameMode === 'rtc') {
    // Lasketaan osumatodennäköisyys skillLevelin perusteella
    // Esim. Skill 1 = 5% osuma, Skill 50 = 30% osuma, Skill 100 = 80% osuma
    // Tämä on yksinkertaistettu malli.
    const hitChance = skillLevel * 0.8 + 5; 
    const random = Math.random() * 100;

    if (random < hitChance) {
      // Osuma!
      // RTC:ssä ei ole väliä kertoimella, mutta palautetaan 1 (single)
      return { score: rtcTarget === 21 ? 25 : rtcTarget, multiplier: 1 };
    } else {
      // Huti. Arvotaan joku muu numero (ei maali)
      let miss = randomInt(1, 20);
      while (miss === rtcTarget) {
        miss = randomInt(1, 20);
      }
      return { score: miss, multiplier: 1 };
    }
  }

  // --- X01 LOGIIKKA ---
  
  // 1. Mihin tähdätään?
  let targetScore = 20;
  let targetMultiplier = 3; // Oletus: T20

  // Jos ollaan lopetusalueella, katsotaan checkout guidesta
  if (currentScore <= 170) {
    const guide = getCheckoutGuide(currentScore);
    if (guide) {
      // Yritetään parsia ensimmäinen heitto guidesta (esim "T20 T20 D20")
      const firstTarget = guide.split(" ")[0]; // "T20"
      
      if (firstTarget === "BULL") { targetScore = 25; targetMultiplier = 2; } // Bullseye (50)
      else if (firstTarget === "25") { targetScore = 25; targetMultiplier = 1; }
      else {
        // Parsitaan "T20", "D10", "20"
        const type = firstTarget.charAt(0);
        if (type === 'T') {
           targetMultiplier = 3;
           targetScore = parseInt(firstTarget.substring(1));
        } else if (type === 'D') {
           targetMultiplier = 2;
           targetScore = parseInt(firstTarget.substring(1));
        } else {
           targetMultiplier = 1;
           targetScore = parseInt(firstTarget);
        }
      }
    }
  }

  // 2. Osumatarkkuus (Simulaatio)
  // Mitä suurempi skill, sitä pienempi hajonta (variance)
  // Skill 100 = osuu lähes aina. Skill 1 = osuu naapureihin.
  
  const accuracy = Math.random() * 100;
  
  // Osuu täydellisesti kohteeseen?
  if (accuracy < skillLevel) {
      return { score: targetScore === 25 && targetMultiplier === 2 ? 50 : targetScore, multiplier: targetMultiplier };
  }

  // Jos ei osunut, simuloidaan virhettä
  // Yksinkertaistus: Botti osuu "singleen" tai viereiseen numeroon
  
  // Jos tähdättiin triplaan, mutta epäonnistuttiin -> usein osuu singleen (kerroin 1)
  if (targetMultiplier === 3 && Math.random() > 0.5) {
      return { score: targetScore, multiplier: 1 };
  }
  
  // Jos tähdättiin tuplaan (lopetus), mutta epäonnistuttiin -> usein osuu singleen tai ohi
  if (targetMultiplier === 2 && Math.random() > 0.5) {
      // Joskus menee yli tai viereen, palautetaan single
      return { score: targetScore, multiplier: 1 };
  }

  // Täysi huti (random numero) - simuloidaan "huonoa heittoa"
  // Oikeasti pitäisi katsoa naapurit (esim 20 vieressä 1 ja 5), mutta random riittää tähän hätään
  return { score: randomInt(1, 20), multiplier: 1 };
};