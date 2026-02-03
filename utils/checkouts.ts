// utils/checkouts.ts

// Määritellään kaikki lopetukset 170-41 (Kuvasi perusteella + standardit)
// Alle 40 hoidetaan logiikalla tai täydennetään tarvittaessa
const HIGH_CHECKOUTS: Record<number, string> = {
  170: "T20 T20 BULL",
  167: "T20 T19 BULL",
  164: "T20 T18 BULL",
  161: "T20 T17 BULL",
  160: "T20 T20 D20",
  158: "T20 T20 D19",
  157: "T20 T19 D20",
  156: "T20 T20 D18",
  155: "T20 T19 D19",
  154: "T20 T18 D20",
  153: "T20 T19 D18",
  152: "T20 T20 D16",
  151: "T20 T17 D20",
  150: "T19 T19 D18",
  149: "T20 T19 D16",
  148: "T20 T20 D14",
  147: "T20 T17 D18",
  146: "T19 T19 D16",
  145: "T20 T15 D20",
  144: "T20 T20 D12",
  143: "T20 T17 D16",
  142: "T20 T14 D20",
  141: "T20 T19 D12",
  140: "T20 T16 D16",
  139: "T19 T14 D20",
  138: "T20 T18 D12",
  137: "T19 T16 D16",
  136: "T20 T20 D8",
  135: "BULL T15 D20", // Tai T20 T13 D18
  134: "T20 T14 D16",
  133: "T20 T19 D8",
  132: "T20 T16 D12", // Tai BULL T14 D20
  131: "T20 T13 D16",
  130: "T20 T18 D8",
  129: "T19 T16 D12",
  128: "T18 T14 D16",
  127: "T20 T17 D8",
  126: "T19 T19 D6",
  125: "BULL T20 D20", // 25-60-40
  124: "T20 T16 D8",
  123: "T19 T16 D9",
  122: "T18 T20 D4",
  121: "T20 T15 D8", // Tai T20 T11 D14
  120: "T20 20 D20",
  119: "T19 T10 D16",
  118: "T20 18 D20",
  117: "T20 17 D20",
  116: "T20 16 D20",
  115: "T20 15 D20",
  114: "T20 14 D20",
  113: "T20 13 D20",
  112: "T20 12 D20",
  111: "T20 19 D16",
  110: "T20 18 D16",
  109: "T20 17 D16", // Tai T19 12 D20
  108: "T20 16 D16",
  107: "T19 18 D16",
  106: "T20 14 D16",
  105: "T20 13 D16", // Tai T19 16 D16
  104: "T20 12 D16", // Tai T16 16 D20
  103: "T20 3 D20",
  102: "T20 10 D16",
  101: "T17 10 D20",
  100: "T20 D20",
  99: "T19 10 D16",
  98: "T20 D19",
  97: "T19 D20",
  96: "T20 D18",
  95: "T19 D19",
  94: "T18 D20",
  93: "T19 D18",
  92: "T20 D16",
  91: "T17 D20",
  90: "T18 D18", // Tai T20 D15
  89: "T19 D16",
  88: "T16 D20", // Tai T20 D14
  87: "T17 D18",
  86: "T18 D16",
  85: "T15 D20",
  84: "T20 D12",
  83: "T17 D16",
  82: "T14 D20", // Tai BULL D16
  81: "T19 D12",
  80: "T20 D10",
  79: "T13 D20", // Tai T19 D11
  78: "T18 D12",
  77: "T19 D10",
  76: "T20 D8",
  75: "T17 D12",
  74: "T14 D16",
  73: "T19 D8",
  72: "T16 D12",
  71: "T13 D16",
  70: "T18 D8",
  69: "T15 D12", // Tai T19 D6
  68: "T20 D4",  // Tai T16 D10
  67: "T17 D8",  // Tai T9 D20
  66: "T10 D18",
  65: "T19 D4",  // Tai 25 D20
  64: "T16 D8",  // Tai D16 D16 (harvinaisempi) tai T14 D11
  63: "T13 D12", // Tai T17 D6
  62: "T10 D16",
  61: "T15 D8",  // Tai 25 D18
  60: "20 D20",
  59: "19 D20",
  58: "18 D20",
  57: "17 D20",
  56: "16 D20",
  55: "15 D20",
  54: "14 D20",
  53: "13 D20",
  52: "12 D20", // Tai T12 D8
  51: "11 D20", // Tai T13 D6
  50: "10 D20", // Tai BULL
  49: "9 D20",
  48: "16 D16",
  47: "7 D20",
  46: "6 D20", // Tai 10 D18
  45: "13 D16", // Tai 5 D20
  44: "4 D20",  // Tai 12 D16
  43: "3 D20",  // Tai 11 D16
  42: "2 D20",  // Tai 10 D16
  41: "1 D20",  // Tai 9 D16
};

// Pienet numerot (40 ja alle), joita ei tarvitse välttämättä listata, 
// mutta listataan varmuuden vuoksi jotta formatti on yhtenäinen
const LOW_CHECKOUTS: Record<number, string> = {
    40: "D20",
    39: "7 D16",
    38: "D19",
    37: "5 D16",
    36: "D18",
    35: "3 D16",
    34: "D17",
    33: "1 D16",
    32: "D16",
    31: "15 D8",
    30: "D15",
    29: "13 D8",
    28: "D14",
    27: "11 D8",
    26: "D13",
    25: "9 D8", // Tai 1 D12
    24: "D12",
    23: "7 D8",
    22: "D11",
    21: "5 D8",
    20: "D10",
    19: "3 D8",
    18: "D9",
    17: "1 D8",
    16: "D8",
    15: "7 D4",
    14: "D7",
    13: "5 D4",
    12: "D6",
    11: "3 D4",
    10: "D5",
    9: "1 D4",
    8: "D4",
    7: "3 D2",
    6: "D3",
    5: "1 D2",
    4: "D2",
    3: "1 D1",
    2: "D1"
};

export const getCheckoutGuide = (score: number): string | null => {
  if (score > 170) return null; // Ei lopetusta
  if (score < 2) return null;   // Mahdoton tai bust

  // 1. Tarkistetaan "High checkouts" listasta
  if (HIGH_CHECKOUTS[score]) return HIGH_CHECKOUTS[score];

  // 2. Tarkistetaan "Low checkouts" listasta
  if (LOW_CHECKOUTS[score]) return LOW_CHECKOUTS[score];

  return "Ei lopetusta"; 
};