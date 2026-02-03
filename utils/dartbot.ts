// utils/dartbot.ts
import { getCheckoutGuide } from "./checkouts";

type BotThrow = {
  score: number;
  multiplier: number;
};

// Apufunktio: Arvo luku väliltä min-max
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// Apufunktio: Määritä mihin botti tähtää
const getTarget = (scoreLeft: number, dartIndex: number): string => {
  // 1. Jos checkout on mahdollinen, käytä checkout guidea
  const guide = getCheckoutGuide(scoreLeft);
  if (guide) {
    const parts = guide.split(" ");
    // Jos opas sanoo "T20 T20 D20", ja heitämme ekaa tikkaa -> tähtää T20.
    if (parts[dartIndex]) return parts[dartIndex];
    // Jos opas on lyhyempi (esim "D20" ja on 2. tikka), ota viimeinen osa
    return parts[parts.length - 1]; 
  }

  // 2. Jos ei checkoutia, tähtää T20 (tai T19 jos blokattu, mutta yksinkertaistetaan T20)
  return "T20";
};

// Apufunktio: Laske osuma perustuen taitotasoon (1-100)
// targetString esim: "T20", "D20", "20", "BULL", "25"
const calculateHit = (targetString: string, skill: number): BotThrow => {
  const isTriple = targetString.startsWith("T");
  const isDouble = targetString.startsWith("D");
  const isBull = targetString === "BULL" || targetString === "25";
  
  // Parsitaan numero (esim "T20" -> 20)
  let targetNum = 20;
  if (isBull) targetNum = 25;
  else if (isTriple || isDouble) targetNum = parseInt(targetString.substring(1));
  else targetNum = parseInt(targetString);

  // --- MATEMATIIKKA ---
  // Arvotaan onnistuminen (0-100). Jos alle skill, onnistuu täydellisesti.
  const roll = Math.random() * 100;
  
  // Täydellinen osuma
  if (roll < skill) {
    if (isBull && targetString === "BULL") return { score: 50, multiplier: 1 }; // Inner Bull
    if (isTriple) return { score: targetNum, multiplier: 3 };
    if (isDouble) return { score: targetNum, multiplier: 2 };
    return { score: targetNum, multiplier: 1 };
  }

  // --- VIRHEET (Miss) ---
  // Jos taito ei riittänyt, mihin osuu?
  
  // 1. Triplaa yritettiin -> Osuu useimmiten singleen
  if (isTriple) {
    // 80% todennäköisyys osua isoon singleen, 20% naapuriin (esim 1 tai 5)
    if (Math.random() < 0.8) return { score: targetNum, multiplier: 1 };
    return { score: Math.random() > 0.5 ? 1 : 5, multiplier: 1 }; // Yksinkertaistettu naapuri
  }

  // 2. Tuplaa yritettiin (Lopetus) -> Vaarallista! Voi mennä ohi taulun tai sisälle singleen.
  if (isDouble) {
    const missRoll = Math.random();
    if (missRoll < 0.4) return { score: targetNum, multiplier: 1 }; // Osuu singleen (ei poikki)
    if (missRoll < 0.7) return { score: 0, multiplier: 0 }; // Ohi taulun (ei poikki, mutta ei bust)
    // Naapuri tuplat (esim D20 -> D5 tai D1) - harvinaista
    return { score: Math.random() > 0.5 ? 1 : 5, multiplier: 2 }; 
  }

  // 3. Bullia yritettiin
  if (isBull) {
    if (Math.random() < 0.5) return { score: 25, multiplier: 1 }; // Outer bull
    return { score: randomInt(1, 20), multiplier: 1 }; // Karkaa numerokehälle
  }

  // 4. Singleä yritettiin -> Osuu johonkin lähelle
  return { score: targetNum, multiplier: 1 };
};

// PÄÄFUNKTIO: Simuloi koko vuoro (1-3 tikkaa)
export const getBotTurn = (currentScore: number, skillLevel: number): BotThrow[] => {
  const throws: BotThrow[] = [];
  let scoreLeft = currentScore;

  for (let i = 0; i < 3; i++) {
    // 1. Päätä kohde
    const target = getTarget(scoreLeft, i);
    
    // 2. Heitä
    const result = calculateHit(target, skillLevel);
    
    // 3. Lisää heitto listaan
    throws.push(result);
    
    // 4. Laske uusi tilanne
    const totalVal = result.score * result.multiplier;
    const nextScore = scoreLeft - totalVal;

    // 5. Tarkista lopetus tai bust
    if (nextScore === 0 && result.multiplier === 2) {
      // Game shot! Lopeta heittäminen tähän.
      break; 
    }
    if (nextScore === 0 && result.score === 50) {
       // Bullseye finish!
       break;
    }

    if (nextScore < 2 && nextScore !== 0) {
      // Bust (jäi 1 tai meni alle 0). Heittovuoro päättyy, mutta hook hoitaa pistelaskun peruutuksen.
      // Palautetaan heitot tähän asti.
      break;
    }
    
    scoreLeft = nextScore;
  }

  return throws;
};