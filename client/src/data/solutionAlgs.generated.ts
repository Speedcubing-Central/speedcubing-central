// GENERATED FILE — do not edit by hand.
// Regenerate with: see the comment atop scripts/generate-solution-algs.ts
//
// Maps each case id to, for every AUF the Trainer can pick ("" / "U" /
// "U'" / "U2"), the shortest algorithm verified (at build time) to
// solve that case scrambled with that AUF — used as the Trainer's
// revealed solution when the user hasn't set a custom preferred alg for
// the case (see AlgTrainerPage.tsx and this script's header comment for
// why this needs to be precomputed rather than built at runtime).
export const SOLUTION_ALGS: Record<string, Record<string, string>> = {
  "OLL1": {
    "": "R U2 R2 F R F' U2 R' F R F'",
    "U": "U R U2 R2 F R F' U2 R' F R F'",
    "U'": "U' R U2 R2 F R F' U2 R' F R F'",
    "U2": "R U2 R2 F R F' U2 R' F R F'"
  },
  "OLL2": {
    "": "y' R U' R2 D' r U r' D R2 U R'",
    "U": "y' U R U' R2 D' r U r' D R2 U R'",
    "U'": "y' U' R U' R2 D' r U r' D R2 U R'",
    "U2": "y' U2 R U' R2 D' r U r' D R2 U R'"
  },
  "OLL3": {
    "": "y' f R U R' U' f' U' F R U R' U' F'",
    "U": "y' U f R U R' U' f' U' F R U R' U' F'",
    "U'": "y' U' f R U R' U' f' U' F R U R' U' F'",
    "U2": "y' U2 f R U R' U' f' U' F R U R' U' F'"
  },
  "OLL4": {
    "": "y' R' F2 R2 U2 R' F' R U2 R2 F2 R",
    "U": "y' U R' F2 R2 U2 R' F' R U2 R2 F2 R",
    "U'": "y' U' R' F2 R2 U2 R' F' R U2 R2 F2 R",
    "U2": "y' U2 R' F2 R2 U2 R' F' R U2 R2 F2 R"
  },
  "OLL5": {
    "": "L' B2 R B R' B L",
    "U": "U L' B2 R B R' B L",
    "U'": "U' L' B2 R B R' B L",
    "U2": "U2 L' B2 R B R' B L"
  },
  "OLL6": {
    "": "L F2 R' F' R F' L'",
    "U": "U L F2 R' F' R F' L'",
    "U'": "U' L F2 R' F' R F' L'",
    "U2": "U2 L F2 R' F' R F' L'"
  },
  "OLL7": {
    "": "L F R' F R F2 L'",
    "U": "U L F R' F R F2 L'",
    "U'": "U' L F R' F R F2 L'",
    "U2": "U2 L F R' F R F2 L'"
  },
  "OLL8": {
    "": "y2 r' U' R U' R' U2 r",
    "U": "y2 U r' U' R U' R' U2 r",
    "U'": "y2 U' r' U' R U' R' U2 r",
    "U2": "y2 U2 r' U' R U' R' U2 r"
  },
  "OLL9": {
    "": "y R U R' U' R' F R2 U R' U' F'",
    "U": "y U R U R' U' R' F R2 U R' U' F'",
    "U'": "y U' R U R' U' R' F R2 U R' U' F'",
    "U2": "y U2 R U R' U' R' F R2 U R' U' F'"
  },
  "OLL10": {
    "": "R U R' U R' F R F' R U2 R'",
    "U": "U R U R' U R' F R F' R U2 R'",
    "U'": "U' R U R' U R' F R F' R U2 R'",
    "U2": "U2 R U R' U R' F R F' R U2 R'"
  },
  "OLL11": {
    "": "r' R2 U R' U R U2 R' U M'",
    "U": "U r' R2 U R' U R U2 R' U M'",
    "U'": "U' r' R2 U R' U R U2 R' U M'",
    "U2": "U2 r' R2 U R' U R U2 R' U M'"
  },
  "OLL12": {
    "": "y' M' R' U' R U' R' U2 R U' M",
    "U": "y' U M' R' U' R U' R' U2 R U' M",
    "U'": "y' U' M' R' U' R U' R' U2 R U' M",
    "U2": "y' U2 M' R' U' R U' R' U2 R U' M"
  },
  "OLL13": {
    "": "F U R U2 R' U' R U R' F'",
    "U": "U F U R U2 R' U' R U R' F'",
    "U'": "U' F U R U2 R' U' R U R' F'",
    "U2": "U2 F U R U2 R' U' R U R' F'"
  },
  "OLL14": {
    "": "R' F R U R' F' R F U' F'",
    "U": "U R' F R U R' F' R F U' F'",
    "U'": "U' R' F R U R' F' R F U' F'",
    "U2": "U2 R' F R U R' F' R F U' F'"
  },
  "OLL15": {
    "": "L' B' L R' U' R U L' B L",
    "U": "U L' B' L R' U' R U L' B L",
    "U'": "U' L' B' L R' U' R U L' B L",
    "U2": "U2 L' B' L R' U' R U L' B L"
  },
  "OLL16": {
    "": "L F L' R U R' U' L F' L'",
    "U": "U L F L' R U R' U' L F' L'",
    "U'": "U' L F L' R U R' U' L F' L'",
    "U2": "U2 L F L' R U R' U' L F' L'"
  },
  "OLL17": {
    "": "R U R' U R' F R F' U2 R' F R F'",
    "U": "U R U R' U R' F R F' U2 R' F R F'",
    "U'": "U' R U R' U R' F R F' U2 R' F R F'",
    "U2": "U2 R U R' U R' F R F' U2 R' F R F'"
  },
  "OLL18": {
    "": "y R U2 R2 F R F' U2 M' U R U' r'",
    "U": "y U R U2 R2 F R F' U2 M' U R U' r'",
    "U'": "y U' R U2 R2 F R F' U2 M' U R U' r'",
    "U2": "y U2 R U2 R2 F R F' U2 M' U R U' r'"
  },
  "OLL19": {
    "": "y S' R U R' S U' R' F R F'",
    "U": "y U S' R U R' S U' R' F R F'",
    "U'": "y U' S' R U R' S U' R' F R F'",
    "U2": "y U2 S' R U R' S U' R' F R F'"
  },
  "OLL20": {
    "": "r U R' U' M2 U R U' R' U' M'",
    "U": "r U R' U' M2 U R U' R' U' M'",
    "U'": "r U R' U' M2 U R U' R' U' M'",
    "U2": "r U R' U' M2 U R U' R' U' M'"
  },
  "OLL21": {
    "": "R U R' U R U' R' U R U2 R'",
    "U": "U R U R' U R U' R' U R U2 R'",
    "U'": "U' R U R' U R U' R' U R U2 R'",
    "U2": "R U R' U R U' R' U R U2 R'"
  },
  "OLL22": {
    "": "R U2 R2 U' R2 U' R2 U2 R",
    "U": "U R U2 R2 U' R2 U' R2 U2 R",
    "U'": "U' R U2 R2 U' R2 U' R2 U2 R",
    "U2": "U2 R U2 R2 U' R2 U' R2 U2 R"
  },
  "OLL23": {
    "": "R2 D R' U2 R D' R' U2 R'",
    "U": "U R2 D R' U2 R D' R' U2 R'",
    "U'": "U' R2 D R' U2 R D' R' U2 R'",
    "U2": "U2 R2 D R' U2 R D' R' U2 R'"
  },
  "OLL24": {
    "": "L F R' F' L' F R F'",
    "U": "U L F R' F' L' F R F'",
    "U'": "U' L F R' F' L' F R F'",
    "U2": "U2 L F R' F' L' F R F'"
  },
  "OLL25": {
    "": "R U2 R D R' U2 R D' R2",
    "U": "U R U2 R D R' U2 R D' R2",
    "U'": "U' R U2 R D R' U2 R D' R2",
    "U2": "U2 R U2 R D R' U2 R D' R2"
  },
  "OLL26": {
    "": "y R U2 R' U' R U' R'",
    "U": "y U R U2 R' U' R U' R'",
    "U'": "y U' R U2 R' U' R U' R'",
    "U2": "y U2 R U2 R' U' R U' R'"
  },
  "OLL27": {
    "": "R U R' U R U2 R'",
    "U": "U R U R' U R U2 R'",
    "U'": "U' R U R' U R U2 R'",
    "U2": "U2 R U R' U R U2 R'"
  },
  "OLL28": {
    "": "r U R' U' M U R U' R'",
    "U": "U r U R' U' M U R U' R'",
    "U'": "U' r U R' U' M U R U' R'",
    "U2": "U2 r U R' U' M U R U' R'"
  },
  "OLL29": {
    "": "L2 U' L B L' U L2 U' L' B' L",
    "U": "U L2 U' L B L' U L2 U' L' B' L",
    "U'": "U' L2 U' L B L' U L2 U' L' B' L",
    "U2": "U2 L2 U' L B L' U L2 U' L' B' L"
  },
  "OLL30": {
    "": "y' r' D' r U' r' D r2 U' r' U r U r'",
    "U": "y' U r' D' r U' r' D r2 U' r' U r U r'",
    "U'": "y' U' r' D' r U' r' D r2 U' r' U r U r'",
    "U2": "y' U2 r' D' r U' r' D r2 U' r' U r U r'"
  },
  "OLL31": {
    "": "R' U' F U R U' R' F' R",
    "U": "U R' U' F U R U' R' F' R",
    "U'": "U' R' U' F U R U' R' F' R",
    "U2": "U2 R' U' F U R U' R' F' R"
  },
  "OLL32": {
    "": "S R U R' U' R' F R f'",
    "U": "U S R U R' U' R' F R f'",
    "U'": "U' S R U R' U' R' F R f'",
    "U2": "U2 S R U R' U' R' F R f'"
  },
  "OLL33": {
    "": "R U R' U' R' F R F'",
    "U": "U R U R' U' R' F R F'",
    "U'": "U' R U R' U' R' F R F'",
    "U2": "U2 R U R' U' R' F R F'"
  },
  "OLL34": {
    "": "y f R f' U' r' U' R U M'",
    "U": "y U f R f' U' r' U' R U M'",
    "U'": "y U' f R f' U' r' U' R U M'",
    "U2": "y U2 f R f' U' r' U' R U M'"
  },
  "OLL35": {
    "": "R U2 R2 F R F' R U2 R'",
    "U": "U R U2 R2 F R F' R U2 R'",
    "U'": "U' R U2 R2 F R F' R U2 R'",
    "U2": "U2 R U2 R2 F R F' R U2 R'"
  },
  "OLL36": {
    "": "y R U R2 F' U' F U R2 U2 R'",
    "U": "y U R U R2 F' U' F U R2 U2 R'",
    "U'": "y U' R U R2 F' U' F U R2 U2 R'",
    "U2": "y U2 R U R2 F' U' F U R2 U2 R'"
  },
  "OLL37": {
    "": "F R' F' R U R U' R'",
    "U": "U F R' F' R U R U' R'",
    "U'": "U' F R' F' R U R U' R'",
    "U2": "U2 F R' F' R U R U' R'"
  },
  "OLL38": {
    "": "R U R' U R U' R' U' R' F R F'",
    "U": "U R U R' U R U' R' U' R' F R F'",
    "U'": "U' R U R' U R U' R' U' R' F R F'",
    "U2": "U2 R U R' U R U' R' U' R' F R F'"
  },
  "OLL39": {
    "": "y' f' r U r' U' r' F r S",
    "U": "y' U f' r U r' U' r' F r S",
    "U'": "y' U' f' r U r' U' r' F r S",
    "U2": "y' U2 f' r U r' U' r' F r S"
  },
  "OLL40": {
    "": "y R' F R U R' U' F' U R",
    "U": "y U R' F R U R' U' F' U R",
    "U'": "y U' R' F R U R' U' F' U R",
    "U2": "y U2 R' F R U R' U' F' U R"
  },
  "OLL41": {
    "": "y2 R U R' U R U2 R' F R U R' U' F'",
    "U": "y2 U R U R' U R U2 R' F R U R' U' F'",
    "U'": "y2 U' R U R' U R U2 R' F R U R' U' F'",
    "U2": "y2 U2 R U R' U R U2 R' F R U R' U' F'"
  },
  "OLL42": {
    "": "R' U' R U' R' U2 R F R U R' U' F'",
    "U": "U R' U' R U' R' U2 R F R U R' U' F'",
    "U'": "U' R' U' R U' R' U2 R F R U R' U' F'",
    "U2": "U2 R' U' R U' R' U2 R F R U R' U' F'"
  },
  "OLL43": {
    "": "y R' U' F' U F R",
    "U": "y U R' U' F' U F R",
    "U'": "y U' R' U' F' U F R",
    "U2": "y U2 R' U' F' U F R"
  },
  "OLL44": {
    "": "U L U' L' B'",
    "U": "U B U L U' L' B'",
    "U'": "U' B U L U' L' B'",
    "U2": "U2 B U L U' L' B'"
  },
  "OLL45": {
    "": "F R U R' U' F'",
    "U": "U F R U R' U' F'",
    "U'": "U' F R U R' U' F'",
    "U2": "U2 F R U R' U' F'"
  },
  "OLL46": {
    "": "R' U' R' F R F' U R",
    "U": "U R' U' R' F R F' U R",
    "U'": "U' R' U' R' F R F' U R",
    "U2": "U2 R' U' R' F R F' U R"
  },
  "OLL47": {
    "": "y' F R' F' R U2 R U' R' U R U2 R'",
    "U": "y' U F R' F' R U2 R U' R' U R U2 R'",
    "U'": "y' U' F R' F' R U2 R U' R' U R U2 R'",
    "U2": "y' U2 F R' F' R U2 R U' R' U R U2 R'"
  },
  "OLL48": {
    "": "F R U R' U' R U R' U' F'",
    "U": "U F R U R' U' R U R' U' F'",
    "U'": "U' F R U R' U' R U R' U' F'",
    "U2": "U2 F R U R' U' R U R' U' F'"
  },
  "OLL49": {
    "": "y2 r U' r2 U r2 U r2 U' r",
    "U": "y2 U r U' r2 U r2 U r2 U' r",
    "U'": "y2 U' r U' r2 U r2 U r2 U' r",
    "U2": "y2 U2 r U' r2 U r2 U r2 U' r"
  },
  "OLL50": {
    "": "L' B L2 F' L2 B' L2 F L'",
    "U": "U L' B L2 F' L2 B' L2 F L'",
    "U'": "U' L' B L2 F' L2 B' L2 F L'",
    "U2": "U2 L' B L2 F' L2 B' L2 F L'"
  },
  "OLL51": {
    "": "y2 F U R U' R' U R U' R' F'",
    "U": "y2 U F U R U' R' U R U' R' F'",
    "U'": "y2 U' F U R U' R' U R U' R' F'",
    "U2": "y2 U2 F U R U' R' U R U' R' F'"
  },
  "OLL52": {
    "": "y2 R' F' U' F U' R U R' U R",
    "U": "y2 U R' F' U' F U' R U R' U R",
    "U'": "y2 U' R' F' U' F U' R U R' U R",
    "U2": "y2 U2 R' F' U' F U' R U R' U R"
  },
  "OLL53": {
    "": "L' B' R B' R' B R B' R' B2 L",
    "U": "U L' B' R B' R' B R B' R' B2 L",
    "U'": "U' L' B' R B' R' B R B' R' B2 L",
    "U2": "U2 L' B' R B' R' B R B' R' B2 L"
  },
  "OLL54": {
    "": "L F R' F R F' R' F R F2 L'",
    "U": "U L F R' F R F' R' F R F2 L'",
    "U'": "U' L F R' F R F' R' F R F2 L'",
    "U2": "U2 L F R' F R F' R' F R F2 L'"
  },
  "OLL55": {
    "": "y R' F U R U' R2 F' R2 U R' U' R",
    "U": "y U R' F U R U' R2 F' R2 U R' U' R",
    "U'": "y U' R' F U R U' R2 F' R2 U R' U' R",
    "U2": "y U2 R' F U R U' R2 F' R2 U R' U' R"
  },
  "OLL56": {
    "": "L F L' U R U' R' U R U' R' L F' L'",
    "U": "U L F L' U R U' R' U R U' R' L F' L'",
    "U'": "U' L F L' U R U' R' U R U' R' L F' L'",
    "U2": "L F L' U R U' R' U R U' R' L F' L'"
  },
  "OLL57": {
    "": "R U R' U' M' U R U' r'",
    "U": "U R U R' U' M' U R U' r'",
    "U'": "U' R U R' U' M' U R U' r'",
    "U2": "R U R' U' M' U R U' r'"
  },
  "Ua": {
    "": "y2 M2 U M U2 M' U M2",
    "U": "y2 U M2 U M U2 M' U M2",
    "U'": "y2 U' M2 U M U2 M' U M2",
    "U2": "y2 U2 M2 U M U2 M' U M2"
  },
  "Ub": {
    "": "y2 M2 U' M U2 M' U' M2",
    "U": "y2 U M2 U' M U2 M' U' M2",
    "U'": "y2 U' M2 U' M U2 M' U' M2",
    "U2": "y2 U2 M2 U' M U2 M' U' M2"
  },
  "Z": {
    "": "M' U' M2 U' M2 U' M' U2 M2",
    "U": "U M' U' M2 U' M2 U' M' U2 M2",
    "U'": "U' M' U' M2 U' M2 U' M' U2 M2",
    "U2": "M' U' M2 U' M2 U' M' U2 M2"
  },
  "H": {
    "": "M2 U' M2 U2 M2 U' M2",
    "U": "M2 U' M2 U2 M2 U' M2",
    "U'": "M2 U' M2 U2 M2 U' M2",
    "U2": "M2 U' M2 U2 M2 U' M2"
  },
  "Aa": {
    "": "R' F R' B2 R F' R' B2 R2",
    "U": "U R' F R' B2 R F' R' B2 R2",
    "U'": "U' R' F R' B2 R F' R' B2 R2",
    "U2": "U2 R' F R' B2 R F' R' B2 R2"
  },
  "Ab": {
    "": "R2 B2 R F R' B2 R F' R",
    "U": "U R2 B2 R F R' B2 R F' R",
    "U'": "U' R2 B2 R F R' B2 R F' R",
    "U2": "U2 R2 B2 R F R' B2 R F' R"
  },
  "E": {
    "": "y x' R U' R' D R U R' D' R U R' D R U' R' D' x",
    "U": "y U x' R U' R' D R U R' D' R U R' D R U' R' D' x",
    "U'": "y U' x' R U' R' D R U R' D' R U R' D R U' R' D' x",
    "U2": "y U2 x' R U' R' D R U R' D' R U R' D R U' R' D' x"
  },
  "T": {
    "": "R U R' U' R' F R2 U' R' U' R U R' F'",
    "U": "U R U R' U' R' F R2 U' R' U' R U R' F'",
    "U'": "U' R U R' U' R' F R2 U' R' U' R U R' F'",
    "U2": "U2 R U R' U' R' F R2 U' R' U' R U R' F'"
  },
  "F": {
    "": "y R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R",
    "U": "y U R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R",
    "U'": "y U' R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R",
    "U2": "y U2 R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R"
  },
  "Ja": {
    "": "y2 x R2 F R F' R U2 r' U r U2 x'",
    "U": "y2 U x R2 F R F' R U2 r' U r U2 x'",
    "U'": "y2 U' x R2 F R F' R U2 r' U r U2 x'",
    "U2": "y2 U2 x R2 F R F' R U2 r' U r U2 x'"
  },
  "Jb": {
    "": "R U R' F' R U R' U' R' F R2 U' R'",
    "U": "U R U R' F' R U R' U' R' F R2 U' R'",
    "U'": "U' R U R' F' R U R' U' R' F R2 U' R'",
    "U2": "U2 R U R' F' R U R' U' R' F R2 U' R'"
  },
  "Ra": {
    "": "y R U' R' U' R U R D R' U' R D' R' U2 R'",
    "U": "y U R U' R' U' R U R D R' U' R D' R' U2 R'",
    "U'": "y U' R U' R' U' R U R D R' U' R D' R' U2 R'",
    "U2": "y U2 R U' R' U' R U R D R' U' R D' R' U2 R'"
  },
  "Rb": {
    "": "R' U2 R U2 R' F R U R' U' R' F' R2",
    "U": "U R' U2 R U2 R' F R U R' U' R' F' R2",
    "U'": "U' R' U2 R U2 R' F R U R' U' R' F' R2",
    "U2": "U2 R' U2 R U2 R' F R U R' U' R' F' R2"
  },
  "Ga": {
    "": "R2 U R' U R' U' R U' R2 D U' R' U R D'",
    "U": "U R2 U R' U R' U' R U' R2 D U' R' U R D'",
    "U'": "U' R2 U R' U R' U' R U' R2 D U' R' U R D'",
    "U2": "U2 R2 U R' U R' U' R U' R2 D U' R' U R D'"
  },
  "Gb": {
    "": "R' U' R U D' R2 U R' U R U' R U' R2",
    "U": "U D R' U' R U D' R2 U R' U R U' R U' R2",
    "U'": "U' D R' U' R U D' R2 U R' U R U' R U' R2",
    "U2": "U2 D R' U' R U D' R2 U R' U R U' R U' R2"
  },
  "Gc": {
    "": "R2 U' R U' R U R' U R2 D' U R U' R' D",
    "U": "U R2 U' R U' R U R' U R2 D' U R U' R' D",
    "U'": "U' R2 U' R U' R U R' U R2 D' U R U' R' D",
    "U2": "U2 R2 U' R U' R U R' U R2 D' U R U' R' D"
  },
  "Gd": {
    "": "R U R' U' D R2 U' R U' R' U R' U R2 D'",
    "U": "U R U R' U' D R2 U' R U' R' U R' U R2 D'",
    "U'": "U' R U R' U' D R2 U' R U' R' U R' U R2 D'",
    "U2": "U2 R U R' U' D R2 U' R U' R' U R' U R2 D'"
  },
  "V": {
    "": "R' U R' U' R D' R' D R' U D' R2 U' R2 D R2",
    "U": "U R' U R' U' R D' R' D R' U D' R2 U' R2 D R2",
    "U'": "U' R' U R' U' R D' R' D R' U D' R2 U' R2 D R2",
    "U2": "U2 R' U R' U' R D' R' D R' U D' R2 U' R2 D R2"
  },
  "Y": {
    "": "F R U' R' U' R U R' F' R U R' U' R' F R F'",
    "U": "U F R U' R' U' R U R' F' R U R' U' R' F R F'",
    "U'": "U' F R U' R' U' R U R' F' R U R' U' R' F R F'",
    "U2": "U2 F R U' R' U' R U R' F' R U R' U' R' F R F'"
  },
  "Na": {
    "": "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'",
    "U": "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'",
    "U'": "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'",
    "U2": "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'"
  },
  "Nb": {
    "": "R' U R U' R' F' U' F R U R' F R' F' R U' R",
    "U": "R' U R U' R' F' U' F R U R' F R' F' R U' R",
    "U'": "R' U R U' R' F' U' F R U R' F R' F' R U' R",
    "U2": "R' U R U' R' F' U' F R U R' F R' F' R U' R"
  },
  "F2L1": {
    "": "U R U' R'",
    "U": "U2 R U' R'",
    "U'": "R U' R'",
    "U2": "U' R U' R'"
  },
  "F2L2": {
    "": "F R' F' R",
    "U": "U F R' F' R",
    "U'": "U' F R' F' R",
    "U2": "U2 F R' F' R"
  },
  "F2L3": {
    "": "F' U' F",
    "U": "U F' U' F",
    "U'": "U' F' U' F",
    "U2": "U2 F' U' F"
  },
  "F2L4": {
    "": "R U R'",
    "U": "U R U R'",
    "U'": "U' R U R'",
    "U2": "U2 R U R'"
  },
  "F2L5": {
    "": "U' R U R' U2 R U' R'",
    "U": "R U R' U2 R U' R'",
    "U'": "U2 R U R' U2 R U' R'",
    "U2": "U R U R' U2 R U' R'"
  },
  "F2L6": {
    "": "U' r U' R' U R U r'",
    "U": "r U' R' U R U r'",
    "U'": "U2 r U' R' U R U r'",
    "U2": "U r U' R' U R U r'"
  },
  "F2L7": {
    "": "U' R U2 R' U' R U2 R'",
    "U": "R U2 R' U' R U2 R'",
    "U'": "U2 R U2 R' U' R U2 R'",
    "U2": "U R U2 R' U' R U2 R'"
  },
  "F2L8": {
    "": "y d R' U2 R U R' U2 R",
    "U": "y U d R' U2 R U R' U2 R",
    "U'": "y U' d R' U2 R U R' U2 R",
    "U2": "y U2 d R' U2 R U R' U2 R"
  },
  "F2L9": {
    "": "U' R U' R' U F' U' F",
    "U": "R U' R' U F' U' F",
    "U'": "U2 R U' R' U F' U' F",
    "U2": "U R U' R' U F' U' F"
  },
  "F2L10": {
    "": "U' R U R' U R U R'",
    "U": "R U R' U R U R'",
    "U'": "U2 R U R' U R U R'",
    "U2": "U R U R' U R U R'"
  },
  "F2L19": {
    "": "U R U2 R' U R U' R'",
    "U": "U2 R U2 R' U R U' R'",
    "U'": "R U2 R' U R U' R'",
    "U2": "U' R U2 R' U R U' R'"
  },
  "F2L20": {
    "": "U' R' U2 R U' R' U R",
    "U": "R' U2 R U' R' U R",
    "U'": "U2 R' U2 R U' R' U R",
    "U2": "U R' U2 R U' R' U R"
  },
  "F2L21": {
    "": "U2 R U R' U R U' R'",
    "U": "U' R U R' U R U' R'",
    "U'": "U R U R' U R U' R'",
    "U2": "R U R' U R U' R'"
  },
  "F2L22": {
    "": "r U' r' U2 r U r'",
    "U": "U r U' r' U2 r U r'",
    "U'": "U' r U' r' U2 r U r'",
    "U2": "U2 r U' r' U2 r U r'"
  },
  "F2L11": {
    "": "U' R U2 R' U F' U' F",
    "U": "R U2 R' U F' U' F",
    "U'": "U2 R U2 R' U F' U' F",
    "U2": "U R U2 R' U F' U' F"
  },
  "F2L12": {
    "": "R U' R' U R U' R' U2 R U' R'",
    "U": "U R U' R' U R U' R' U2 R U' R'",
    "U'": "U' R U' R' U R U' R' U2 R U' R'",
    "U2": "U2 R U' R' U R U' R' U2 R U' R'"
  },
  "F2L13": {
    "": "U R' U R U' R' U' R",
    "U": "U2 R' U R U' R' U' R",
    "U'": "R' U R U' R' U' R",
    "U2": "U' R' U R U' R' U' R"
  },
  "F2L14": {
    "": "U' R U' R' U R U R'",
    "U": "R U' R' U R U R'",
    "U'": "U2 R U' R' U R U R'",
    "U2": "U R U' R' U R U R'"
  },
  "F2L15": {
    "": "R' D' R U' R' D R U R U' R'",
    "U": "U R' D' R U' R' D R U R U' R'",
    "U'": "U' R' D' R U' R' D R U R U' R'",
    "U2": "U2 R' D' R U' R' D R U R U' R'"
  },
  "F2L16": {
    "": "R U' R' U2 F' U' F",
    "U": "U R U' R' U2 F' U' F",
    "U'": "U' R U' R' U2 F' U' F",
    "U2": "U2 R U' R' U2 F' U' F"
  },
  "F2L17": {
    "": "R U2 R' U' R U R'",
    "U": "U R U2 R' U' R U R'",
    "U'": "U' R U2 R' U' R U R'",
    "U2": "U2 R U2 R' U' R U R'"
  },
  "F2L18": {
    "": "R' U2 R U R' U' R",
    "U": "U R' U2 R U R' U' R",
    "U'": "U' R' U2 R U R' U' R",
    "U2": "U2 R' U2 R U R' U' R"
  },
  "F2L23": {
    "": "U R U' R' U' R U' R' U R U' R'",
    "U": "U2 R U' R' U' R U' R' U R U' R'",
    "U'": "R U' R' U' R U' R' U R U' R'",
    "U2": "U' R U' R' U' R U' R' U R U' R'"
  },
  "F2L24": {
    "": "F U R U' R' F' R U' R'",
    "U": "U F U R U' R' F' R U' R'",
    "U'": "U' F U R U' R' F' R U' R'",
    "U2": "U2 F U R U' R' F' R U' R'"
  },
  "F2L25": {
    "": "U' R' F R F' R U R'",
    "U": "R' F R F' R U R'",
    "U'": "U2 R' F R F' R U R'",
    "U2": "U R' F R F' R U R'"
  },
  "F2L26": {
    "": "U R U' R' F R' F' R",
    "U": "U2 R U' R' F R' F' R",
    "U'": "R U' R' F R' F' R",
    "U2": "U' R U' R' F R' F' R"
  },
  "F2L27": {
    "": "R U' R' U R U' R'",
    "U": "U R U' R' U R U' R'",
    "U'": "U' R U' R' U R U' R'",
    "U2": "U2 R U' R' U R U' R'"
  },
  "F2L28": {
    "": "R U R' U' F R' F' R",
    "U": "U R U R' U' F R' F' R",
    "U'": "U' R U R' U' F R' F' R",
    "U2": "U2 R U R' U' F R' F' R"
  },
  "F2L29": {
    "": "R' F R F' U R U' R'",
    "U": "U R' F R F' U R U' R'",
    "U'": "U' R' F R F' U R U' R'",
    "U2": "U2 R' F R F' U R U' R'"
  },
  "F2L30": {
    "": "R U R' U' R U R'",
    "U": "U R U R' U' R U R'",
    "U'": "U' R U R' U' R U R'",
    "U2": "U2 R U R' U' R U R'"
  },
  "F2L31": {
    "": "U' R' F R F' R U' R'",
    "U": "R' F R F' R U' R'",
    "U'": "U2 R' F R F' R U' R'",
    "U2": "U R' F R F' R U' R'"
  },
  "F2L32": {
    "": "U R U' R' U R U' R' U R U' R'",
    "U": "U2 R U' R' U R U' R' U R U' R'",
    "U'": "R U' R' U R U' R' U R U' R'",
    "U2": "U' R U' R' U R U' R' U R U' R'"
  },
  "F2L33": {
    "": "U' R U' R' U2 R U' R'",
    "U": "R U' R' U2 R U' R'",
    "U'": "U2 R U' R' U2 R U' R'",
    "U2": "U R U' R' U2 R U' R'"
  },
  "F2L34": {
    "": "U R U R' U2 R U R'",
    "U": "U2 R U R' U2 R U R'",
    "U'": "R U R' U2 R U R'",
    "U2": "U' R U R' U2 R U R'"
  },
  "F2L35": {
    "": "U' R U R' U F' U' F",
    "U": "R U R' U F' U' F",
    "U'": "U2 R U R' U F' U' F",
    "U2": "U R U R' U F' U' F"
  },
  "F2L36": {
    "": "U F' U' F U' R U R'",
    "U": "U2 F' U' F U' R U R'",
    "U'": "F' U' F U' R U R'",
    "U2": "U' F' U' F U' R U R'"
  },
  "F2L37": {
    "": "R2 U2 F R2 F' U2 R' U R'",
    "U": "U R2 U2 F R2 F' U2 R' U R'",
    "U'": "U' R2 U2 F R2 F' U2 R' U R'",
    "U2": "U2 R2 U2 F R2 F' U2 R' U R'"
  },
  "F2L38": {
    "": "R U' R' U' R U R' U2 R U' R'",
    "U": "U R U' R' U' R U R' U2 R U' R'",
    "U'": "U' R U' R' U' R U R' U2 R U' R'",
    "U2": "U2 R U' R' U' R U R' U2 R U' R'"
  },
  "F2L39": {
    "": "R U' R' U R U2 R' U R U' R'",
    "U": "U R U' R' U R U2 R' U R U' R'",
    "U'": "U' R U' R' U R U2 R' U R U' R'",
    "U2": "U2 R U' R' U R U2 R' U R U' R'"
  },
  "F2L40": {
    "": "r U' r' U2 r U r' R U R'",
    "U": "U r U' r' U2 r U r' R U R'",
    "U'": "U' r U' r' U2 r U r' R U R'",
    "U2": "U2 r U' r' U2 r U r' R U R'"
  },
  "F2L41": {
    "": "R U' R' r U' r' U2 r U r'",
    "U": "U R U' R' r U' r' U2 r U r'",
    "U'": "U' R U' R' r U' r' U2 r U r'",
    "U2": "U2 R U' R' r U' r' U2 r U r'"
  },
  "COLL-A1": {
    "": "y R U2 R' U' R U' R'",
    "U": "y U R U2 R' U' R U' R'",
    "U'": "y U' R U2 R' U' R U' R'",
    "U2": "y U2 R U2 R' U' R U' R'"
  },
  "COLL-A2": {
    "": "y2 R2 D R' U R D' R' U R' U' R U' R'",
    "U": "y2 U R2 D R' U R D' R' U R' U' R U' R'",
    "U'": "y2 U' R2 D R' U R D' R' U R' U' R U' R'",
    "U2": "y2 U2 R2 D R' U R D' R' U R' U' R U' R'"
  },
  "COLL-A3": {
    "": "y2 R2 D R' U2 R D' R2 U' R U' R'",
    "U": "y2 U R2 D R' U2 R D' R2 U' R U' R'",
    "U'": "y2 U' R2 D R' U2 R D' R2 U' R U' R'",
    "U2": "y2 U2 R2 D R' U2 R D' R2 U' R U' R'"
  },
  "COLL-A4": {
    "": "y2 R' U' R U' R2 D' R U2 R' D R2",
    "U": "y2 U R' U' R U' R2 D' R U2 R' D R2",
    "U'": "y2 U' R' U' R U' R2 D' R U2 R' D R2",
    "U2": "y2 U2 R' U' R U' R2 D' R U2 R' D R2"
  },
  "COLL-A5": {
    "": "y2 r' F R F' r U R'",
    "U": "y2 U r' F R F' r U R'",
    "U'": "y2 U' r' F R F' r U R'",
    "U2": "y2 U2 r' F R F' r U R'"
  },
  "COLL-A6": {
    "": "R U' R' U2 R U' R' U2 R' D' R U R' D R",
    "U": "U R U' R' U2 R U' R' U2 R' D' R U R' D R",
    "U'": "U' R U' R' U2 R U' R' U2 R' D' R U R' D R",
    "U2": "U2 R U' R' U2 R U' R' U2 R' D' R U R' D R"
  },
  "COLL-S1": {
    "": "R U R' U R U2 R'",
    "U": "U R U R' U R U2 R'",
    "U'": "U' R U R' U R U2 R'",
    "U2": "U2 R U R' U R U2 R'"
  },
  "COLL-S2": {
    "": "y2 R U R' U R2 D R' U2 R D' R2",
    "U": "y2 U R U R' U R2 D R' U2 R D' R2",
    "U'": "y2 U' R U R' U R2 D R' U2 R D' R2",
    "U2": "y2 U2 R U R' U R2 D R' U2 R D' R2"
  },
  "COLL-S3": {
    "": "L' R U R' U' L U2 R U2 R'",
    "U": "U L' R U R' U' L U2 R U2 R'",
    "U'": "U' L' R U R' U' L U2 R U2 R'",
    "U2": "U2 L' R U R' U' L U2 R U2 R'"
  },
  "COLL-S4": {
    "": "y' R U R' U R U' R D R' U' R D' R2",
    "U": "y' U R U R' U R U' R D R' U' R D' R2",
    "U'": "y' U' R U R' U R U' R D R' U' R D' R2",
    "U2": "y' U2 R U R' U R U' R D R' U' R D' R2"
  },
  "COLL-S5": {
    "": "R U' L' U R' U' L",
    "U": "U R U' L' U R' U' L",
    "U'": "U' R U' L' U R' U' L",
    "U2": "U2 R U' L' U R' U' L"
  },
  "COLL-S6": {
    "": "y2 R U R' F' R U R' U R U2 R' F R U' R'",
    "U": "y2 U R U R' F' R U R' U R U2 R' F R U' R'",
    "U'": "y2 U' R U R' F' R U R' U R U2 R' F R U' R'",
    "U2": "y2 U2 R U R' F' R U R' U R U2 R' F R U' R'"
  },
  "COLL-L1": {
    "": "y' R U R' U R U' R' U R U' R' U R U2 R'",
    "U": "y' U R U R' U R U' R' U R U' R' U R U2 R'",
    "U'": "y' U' R U R' U R U' R' U R U' R' U R U2 R'",
    "U2": "y' U2 R U R' U R U' R' U R U' R' U R U2 R'"
  },
  "COLL-L2": {
    "": "R' U2 R' D' R U2 R' D R2",
    "U": "U R' U2 R' D' R U2 R' D R2",
    "U'": "U' R' U2 R' D' R U2 R' D R2",
    "U2": "U2 R' U2 R' D' R U2 R' D R2"
  },
  "COLL-L3": {
    "": "y R U2 R D R' U2 R D' R2",
    "U": "y U R U2 R D R' U2 R D' R2",
    "U'": "y U' R U2 R D R' U2 R D' R2",
    "U2": "y U2 R U2 R D R' U2 R D' R2"
  },
  "COLL-L4": {
    "": "y F R' F' r U R U' r'",
    "U": "y U F R' F' r U R U' r'",
    "U'": "y U' F R' F' r U R U' r'",
    "U2": "y U2 F R' F' r U R U' r'"
  },
  "COLL-L5": {
    "": "y2 F' r U R' U' r' F R",
    "U": "y2 U F' r U R' U' r' F R",
    "U'": "y2 U' F' r U R' U' r' F R",
    "U2": "y2 U2 F' r U R' U' r' F R"
  },
  "COLL-L6": {
    "": "y r U2 R2 F R F' R U2 r'",
    "U": "y U r U2 R2 F R F' R U2 r'",
    "U'": "y U' r U2 R2 F R F' R U2 r'",
    "U2": "y U2 r U2 R2 F R F' R U2 r'"
  },
  "COLL-U1": {
    "": "R' U' R U' R' U2 R2 U R' U R U2 R'",
    "U": "U R' U' R U' R' U2 R2 U R' U R U2 R'",
    "U'": "U' R' U' R U' R' U2 R2 U R' U R U2 R'",
    "U2": "U2 R' U' R U' R' U2 R2 U R' U R U2 R'"
  },
  "COLL-U2": {
    "": "R' F R U' R' U' R U R' F' R U R' U' R' F R F' R",
    "U": "U R' F R U' R' U' R U R' F' R U R' U' R' F R F' R",
    "U'": "U' R' F R U' R' U' R U R' F' R U R' U' R' F R F' R",
    "U2": "U2 R' F R U' R' U' R U R' F' R U R' U' R' F R F' R"
  },
  "COLL-U3": {
    "": "y2 R2 D R' U2 R D' R' U2 R'",
    "U": "y2 U R2 D R' U2 R D' R' U2 R'",
    "U'": "y2 U' R2 D R' U2 R D' R' U2 R'",
    "U2": "y2 U2 R2 D R' U2 R D' R' U2 R'"
  },
  "COLL-U4": {
    "": "F R U' R' U R U R' U R U' R' F'",
    "U": "U F R U' R' U R U R' U R U' R' F'",
    "U'": "U' F R U' R' U R U R' U R U' R' F'",
    "U2": "U2 F R U' R' U R U R' U R U' R' F'"
  },
  "COLL-U5": {
    "": "R2 D' R U2 R' D R U2 R",
    "U": "U R2 D' R U2 R' D R U2 R",
    "U'": "U' R2 D' R U2 R' D R U2 R",
    "U2": "U2 R2 D' R U2 R' D R U2 R"
  },
  "COLL-U6": {
    "": "R2 D' R U R' D R U R U' R' U' R",
    "U": "U R2 D' R U R' D R U R U' R' U' R",
    "U'": "U' R2 D' R U R' D R U R U' R' U' R",
    "U2": "U2 R2 D' R U R' D R U R U' R' U' R"
  },
  "COLL-T1": {
    "": "R U2 R' U' R U' R2 U2 R U R' U R",
    "U": "U R U2 R' U' R U' R2 U2 R U R' U R",
    "U'": "U' R U2 R' U' R U' R2 U2 R U R' U R",
    "U2": "U2 R U2 R' U' R U' R2 U2 R U R' U R"
  },
  "COLL-T2": {
    "": "R' U R U2 R' L' U R U' L",
    "U": "U R' U R U2 R' L' U R U' L",
    "U'": "U' R' U R U2 R' L' U R U' L",
    "U2": "U2 R' U R U2 R' L' U R U' L"
  },
  "COLL-T3": {
    "": "y R' F' r U R U' r' F",
    "U": "y U R' F' r U R U' r' F",
    "U'": "y U' R' F' r U R U' r' F",
    "U2": "y U2 R' F' r U R U' r' F"
  },
  "COLL-T4": {
    "": "y2 F R U R' U' R U' R' U' R U R' F'",
    "U": "y2 U F R U R' U' R U' R' U' R U R' F'",
    "U'": "y2 U' F R U R' U' R U' R' U' R U R' F'",
    "U2": "y2 U2 F R U R' U' R U' R' U' R U R' F'"
  },
  "COLL-T5": {
    "": "y' r U R' U' r' F R F'",
    "U": "y' U r U R' U' r' F R F'",
    "U'": "y' U' r U R' U' r' F R F'",
    "U2": "y' U2 r U R' U' r' F R F'"
  },
  "COLL-T6": {
    "": "R' U R2 D L' B2 L D' R2 U' R",
    "U": "U R' U R2 D L' B2 L D' R2 U' R",
    "U'": "U' R' U R2 D L' B2 L D' R2 U' R",
    "U2": "U2 R' U R2 D L' B2 L D' R2 U' R"
  },
  "COLL-P1": {
    "": "R U2 R2 U' R2 U' R2 U2 R",
    "U": "U R U2 R2 U' R2 U' R2 U2 R",
    "U'": "U' R U2 R2 U' R2 U' R2 U2 R",
    "U2": "U2 R U2 R2 U' R2 U' R2 U2 R"
  },
  "COLL-P2": {
    "": "y F U R U' R' U R U' R2 F' R U R U' R'",
    "U": "y U F U R U' R' U R U' R2 F' R U R U' R'",
    "U'": "y U' F U R U' R' U R U' R2 F' R U R U' R'",
    "U2": "y U2 F U R U' R' U R U' R2 F' R U R U' R'"
  },
  "COLL-P3": {
    "": "R' U' F' R U R' U' R' F R2 U2 R' U2 R",
    "U": "U R' U' F' R U R' U' R' F R2 U2 R' U2 R",
    "U'": "U' R' U' F' R U R' U' R' F R2 U2 R' U2 R",
    "U2": "U2 R' U' F' R U R' U' R' F R2 U2 R' U2 R"
  },
  "COLL-P4": {
    "": "R U R' U' R' F R2 U R' U' R U R' U' F'",
    "U": "U R U R' U' R' F R2 U R' U' R U R' U' F'",
    "U'": "U' R U R' U' R' F R2 U R' U' R U R' U' F'",
    "U2": "U2 R U R' U' R' F R2 U R' U' R U R' U' F'"
  },
  "COLL-P5": {
    "": "R U' L' U R' U L U L' U L",
    "U": "U R U' L' U R' U L U L' U L",
    "U'": "U' R U' L' U R' U L U L' U L",
    "U2": "U2 R U' L' U R' U L U L' U L"
  },
  "COLL-P6": {
    "": "R' F' U' F U' R U S' R' U R S",
    "U": "U R' F' U' F U' R U S' R' U R S",
    "U'": "U' R' F' U' F U' R U S' R' U R S",
    "U2": "U2 R' F' U' F U' R U S' R' U R S"
  },
  "COLL-H1": {
    "": "R U R' U R U' R' U R U2 R'",
    "U": "U R U R' U R U' R' U R U2 R'",
    "U'": "U' R U R' U R U' R' U R U2 R'",
    "U2": "R U R' U R U' R' U R U2 R'"
  },
  "COLL-H2": {
    "": "F R U' R' U R U2 R' U' R U R' U' F'",
    "U": "U F R U' R' U R U2 R' U' R U R' U' F'",
    "U'": "U' F R U' R' U R U2 R' U' R U R' U' F'",
    "U2": "U2 F R U' R' U R U2 R' U' R U R' U' F'"
  },
  "COLL-H3": {
    "": "R U R' U R U L' U R' U' L",
    "U": "U R U R' U R U L' U R' U' L",
    "U'": "U' R U R' U R U L' U R' U' L",
    "U2": "U2 R U R' U R U L' U R' U' L"
  },
  "COLL-H4": {
    "": "y F R U R' U' R U R' U' R U R' U' F'",
    "U": "y U F R U R' U' R U R' U' R U R' U' F'",
    "U'": "y U' F R U R' U' R U R' U' R U R' U' F'",
    "U2": "y U2 F R U R' U' R U R' U' R U R' U' F'"
  },
  "2x2-oll-sune": {
    "": "R U R' U R U2 R'",
    "U": "U R U R' U R U2 R'",
    "U'": "U' R U R' U R U2 R'",
    "U2": "U2 R U R' U R U2 R'"
  },
  "2x2-oll-anti-sune": {
    "": "R U2 R' U' R U' R'",
    "U": "U R U2 R' U' R U' R'",
    "U'": "U' R U2 R' U' R U' R'",
    "U2": "U2 R U2 R' U' R U' R'"
  },
  "2x2-oll-pi": {
    "": "F R U R' U' R U R' U' F'",
    "U": "U F R U R' U' R U R' U' F'",
    "U'": "U' F R U R' U' R U R' U' F'",
    "U2": "U2 F R U R' U' R U R' U' F'"
  },
  "2x2-oll-p": {
    "": "F R U R' U' F'",
    "U": "U F R U R' U' F'",
    "U'": "U' F R U R' U' F'",
    "U2": "U2 F R U R' U' F'"
  },
  "2x2-oll-l": {
    "": "y F' R U R' U' R' F R",
    "U": "y U F' R U R' U' R' F R",
    "U'": "y U' F' R U R' U' R' F R",
    "U2": "y U2 F' R U R' U' R' F R"
  },
  "2x2-oll-t": {
    "": "R U R' U' R' F R F'",
    "U": "U R U R' U' R' F R F'",
    "U'": "U' R U R' U' R' F R F'",
    "U2": "U2 R U R' U' R' F R F'"
  },
  "2x2-oll-h": {
    "": "R2 U2 R' U2 R2",
    "U": "U R2 U2 R' U2 R2",
    "U'": "U' R2 U2 R' U2 R2",
    "U2": "R2 U2 R' U2 R2"
  },
  "2x2-pbl-adj": {
    "": "R U R' F' R U R' U' R' F R2 U' R'",
    "U": "U R U R' F' R U R' U' R' F R2 U' R'",
    "U'": "U' R U R' F' R U R' U' R' F R2 U' R'",
    "U2": "U2 R U R' F' R U R' U' R' F R2 U' R'"
  },
  "2x2-pbl-opp": {
    "": "R U' R' U' F2 U' R U R' U F2",
    "U": "U R U' R' U' F2 U' R U R' U F2",
    "U'": "U' R U' R' U' F2 U' R U R' U F2",
    "U2": "U2 R U' R' U' F2 U' R U R' U F2"
  },
  "2x2-pbl-opp-opp": {
    "": "R2 F2 R2",
    "U": "U R2 F2 R2",
    "U'": "U' R2 F2 R2",
    "U2": "U2 R2 F2 R2"
  },
  "2x2-pbl-adj-adj": {
    "": "R2 U' B2 U2 R2 U' R2",
    "U": "U R2 U' B2 U2 R2 U' R2",
    "U'": "U' R2 U' B2 U2 R2 U' R2",
    "U2": "U2 R2 U' B2 U2 R2 U' R2"
  },
  "2x2-pbl-adj-opp": {
    "": "R U' R F2 R' U R'",
    "U": "U R U' R F2 R' U R'",
    "U'": "U' R U' R F2 R' U R'",
    "U2": "U2 R U' R F2 R' U R'"
  },
  "2x2-pbl-opp-adj": {
    "": "R2 U R2 U' R2 U R2 U' R2",
    "U": "U R2 U R2 U' R2 U R2 U' R2",
    "U'": "U' R2 U R2 U' R2 U R2 U' R2",
    "U2": "U2 R2 U R2 U' R2 U R2 U' R2"
  },
  "CLL-AS-1": {
    "": "y R U2 R' U' R U' R'",
    "U": "y U R U2 R' U' R U' R'",
    "U'": "y U' R U2 R' U' R U' R'",
    "U2": "y U2 R U2 R' U' R U' R'"
  },
  "CLL-AS-2": {
    "": "R U2 R' F R' F' R U' R U' R'",
    "U": "U R U2 R' F R' F' R U' R U' R'",
    "U'": "U' R U2 R' F R' F' R U' R U' R'",
    "U2": "U2 R U2 R' F R' F' R U' R U' R'"
  },
  "CLL-AS-3": {
    "": "y2 F' L F L' U2 L' U2 L",
    "U": "y2 U F' L F L' U2 L' U2 L",
    "U'": "y2 U' F' L F L' U2 L' U2 L",
    "U2": "y2 U2 F' L F L' U2 L' U2 L"
  },
  "CLL-AS-4": {
    "": "y2 R' F R F' R U R'",
    "U": "y2 U R' F R F' R U R'",
    "U'": "y2 U' R' F R F' R U R'",
    "U2": "y2 U2 R' F R F' R U R'"
  },
  "CLL-AS-5": {
    "": "R U2 R' U2 R' F R F'",
    "U": "U R U2 R' U2 R' F R F'",
    "U'": "U' R U2 R' U2 R' F R F'",
    "U2": "U2 R U2 R' U2 R' F R F'"
  },
  "CLL-AS-6": {
    "": "y' R U2 R' U' R U' R' F R' F' R U R U' R' U'",
    "U": "y' U R U2 R' U' R U' R' F R' F' R U R U' R' U'",
    "U'": "y' U' R U2 R' U' R U' R' F R' F' R U R U' R' U'",
    "U2": "y' U2 R U2 R' U' R U' R' F R' F' R U R U' R' U'"
  },
  "CLL-H-1": {
    "": "F R2 U' R2 U' R2 U R2 F'",
    "U": "U F R2 U' R2 U' R2 U R2 F'",
    "U'": "U' F R2 U' R2 U' R2 U R2 F'",
    "U2": "U2 F R2 U' R2 U' R2 U R2 F'"
  },
  "CLL-H-2": {
    "": "R U R' U R U R' F R' F' R",
    "U": "U R U R' U R U R' F R' F' R",
    "U'": "U' R U R' U R U R' F R' F' R",
    "U2": "U2 R U R' U R U R' F R' F' R"
  },
  "CLL-H-3": {
    "": "y F R U R' U' R U R' U' R U R' U' F'",
    "U": "y U F R U R' U' R U R' U' R U R' U' F'",
    "U'": "y U' F R U R' U' R U R' U' R U R' U' F'",
    "U2": "y U2 F R U R' U' R U R' U' R U R' U' F'"
  },
  "CLL-H-4": {
    "": "y R2 U2 R' U2 R2",
    "U": "y U R2 U2 R' U2 R2",
    "U'": "y U' R2 U2 R' U2 R2",
    "U2": "y U2 R2 U2 R' U2 R2"
  },
  "CLL-L-1": {
    "": "y R U2 R' F' R U2 R' U R' F2 R",
    "U": "y U R U2 R' F' R U2 R' U R' F2 R",
    "U'": "y U' R U2 R' F' R U2 R' U R' F2 R",
    "U2": "y U2 R U2 R' F' R U2 R' U R' F2 R"
  },
  "CLL-L-2": {
    "": "y2 R U2 R2 F2 R U R' F2 R F'",
    "U": "y2 U R U2 R2 F2 R U R' F2 R F'",
    "U'": "y2 U' R U2 R2 F2 R U R' F2 R F'",
    "U2": "y2 U2 R U2 R2 F2 R U R' F2 R F'"
  },
  "CLL-L-3": {
    "": "y2 R' U R' U2 R U' R' U R U' R2",
    "U": "y2 U R' U R' U2 R U' R' U R U' R2",
    "U'": "y2 U' R' U R' U2 R U' R' U R U' R2",
    "U2": "y2 U2 R' U R' U2 R U' R' U R U' R2"
  },
  "CLL-L-4": {
    "": "y R U2 R2 F R F' R U2 R'",
    "U": "y U R U2 R2 F R F' R U2 R'",
    "U'": "y U' R U2 R2 F R F' R U2 R'",
    "U2": "y U2 R U2 R2 F R F' R U2 R'"
  },
  "CLL-L-5": {
    "": "F R' F' R U R U' R'",
    "U": "U F R' F' R U R U' R'",
    "U'": "U' F R' F' R U R U' R'",
    "U2": "U2 F R' F' R U R U' R'"
  },
  "CLL-L-6": {
    "": "y2 F' R U R' U' R' F R",
    "U": "y2 U F' R U R' U' R' F R",
    "U'": "y2 U' F' R U R' U' R' F R",
    "U2": "y2 U2 F' R U R' U' R' F R"
  },
  "CLL-Pi-1": {
    "": "y F R' F' R U2 R U' R' U R U2 R'",
    "U": "y U F R' F' R U2 R U' R' U R U2 R'",
    "U'": "y U' F R' F' R U2 R U' R' U R U2 R'",
    "U2": "y U2 F R' F' R U2 R U' R' U R U2 R'"
  },
  "CLL-Pi-2": {
    "": "R U2 R' U' R U R' U2 R' F R F'",
    "U": "U R U2 R' U' R U R' U2 R' F R F'",
    "U'": "U' R U2 R' U' R U R' U2 R' F R F'",
    "U2": "U2 R U2 R' U' R U R' U2 R' F R F'"
  },
  "CLL-Pi-3": {
    "": "y F R2 U' R2 U R2 U R2 F'",
    "U": "y U F R2 U' R2 U R2 U R2 F'",
    "U'": "y U' F R2 U' R2 U R2 U R2 F'",
    "U2": "y U2 F R2 U' R2 U R2 U R2 F'"
  },
  "CLL-Pi-4": {
    "": "y2 R' F R F' R U' R' U' R U' R'",
    "U": "y2 U R' F R F' R U' R' U' R U' R'",
    "U'": "y2 U' R' F R F' R U' R' U' R U' R'",
    "U2": "y2 U2 R' F R F' R U' R' U' R U' R'"
  },
  "CLL-Pi-5": {
    "": "y' R' U' R' F R F' R U' R' U2 R",
    "U": "y' U R' U' R' F R F' R U' R' U2 R",
    "U'": "y' U' R' U' R' F R F' R U' R' U2 R",
    "U2": "y' U2 R' U' R' F R F' R U' R' U2 R"
  },
  "CLL-Pi-6": {
    "": "F R U R' U' R U R' U' F'",
    "U": "U F R U R' U' R U R' U' F'",
    "U'": "U' F R U R' U' R U R' U' F'",
    "U2": "U2 F R U R' U' R U R' U' F'"
  },
  "CLL-Sune-1": {
    "": "L' U2 L U2 L F' L' F",
    "U": "U L' U2 L U2 L F' L' F",
    "U'": "U' L' U2 L U2 L F' L' F",
    "U2": "U2 L' U2 L U2 L F' L' F"
  },
  "CLL-Sune-2": {
    "": "R U R' U' R' F R F' R U R' U R U2 R'",
    "U": "U R U R' U' R' F R F' R U R' U R U2 R'",
    "U'": "U' R U R' U' R' F R F' R U R' U R U2 R'",
    "U2": "U2 R U R' U' R' F R F' R U R' U R U2 R'"
  },
  "CLL-Sune-3": {
    "": "R U' R' F R' F' R",
    "U": "U R U' R' F R' F' R",
    "U'": "U' R U' R' F R' F' R",
    "U2": "U2 R U' R' F R' F' R"
  },
  "CLL-Sune-4": {
    "": "F R' F' R U2 R U2 R'",
    "U": "U F R' F' R U2 R U2 R'",
    "U'": "U' F R' F' R U2 R U2 R'",
    "U2": "U2 F R' F' R U2 R U2 R'"
  },
  "CLL-Sune-5": {
    "": "y2 R U R' U R' F R F' R U2 R'",
    "U": "y2 U R U R' U R' F R F' R U2 R'",
    "U'": "y2 U' R U R' U R' F R F' R U2 R'",
    "U2": "y2 U2 R U R' U R' F R F' R U2 R'"
  },
  "CLL-Sune-6": {
    "": "R U R' U R U2 R'",
    "U": "U R U R' U R U2 R'",
    "U'": "U' R U R' U R U2 R'",
    "U2": "U2 R U R' U R U2 R'"
  },
  "CLL-T-1": {
    "": "y' R U R' U' R' F R F'",
    "U": "y' U R U R' U' R' F R F'",
    "U'": "y' U' R U R' U' R' F R F'",
    "U2": "y' U2 R U R' U' R' F R F'"
  },
  "CLL-T-2": {
    "": "L' U' L U L F' L' F",
    "U": "U L' U' L U L F' L' F",
    "U'": "U' L' U' L U L F' L' F",
    "U2": "U2 L' U' L U L F' L' F"
  },
  "CLL-T-3": {
    "": "F U' R U2 R' U' F2 R U R'",
    "U": "U F U' R U2 R' U' F2 R U R'",
    "U'": "U' F U' R U2 R' U' F2 R U R'",
    "U2": "U2 F U' R U2 R' U' F2 R U R'"
  },
  "CLL-T-4": {
    "": "R' U R U2 R2 F' R U' R' F2 R2",
    "U": "U R' U R U2 R2 F' R U' R' F2 R2",
    "U'": "U' R' U R U2 R2 F' R U' R' F2 R2",
    "U2": "U2 R' U R U2 R2 F' R U' R' F2 R2"
  },
  "CLL-T-5": {
    "": "y2 F R U R' U' R U' R' U' R U R' F'",
    "U": "y2 U F R U R' U' R U' R' U' R U R' F'",
    "U'": "y2 U' F R U R' U' R U' R' U' R U R' F'",
    "U2": "y2 U2 F R U R' U' R U' R' U' R U R' F'"
  },
  "CLL-T-6": {
    "": "R' U R U2 R2 F R F' R",
    "U": "U R' U R U2 R2 F R F' R",
    "U'": "U' R' U R U2 R2 F R F' R",
    "U2": "U2 R' U R U2 R2 F R F' R"
  },
  "CLL-U-1": {
    "": "y' F R U R' U' F'",
    "U": "y' U F R U R' U' F'",
    "U'": "y' U' F R U R' U' F'",
    "U2": "y' U2 F R U R' U' F'"
  },
  "CLL-U-2": {
    "": "R' U' R2 U R' U2 R U2 R' U R'",
    "U": "U R' U' R2 U R' U2 R U2 R' U R'",
    "U'": "U' R' U' R2 U R' U2 R U2 R' U R'",
    "U2": "U2 R' U' R2 U R' U2 R U2 R' U R'"
  },
  "CLL-U-3": {
    "": "y2 F R U R' U2 F' R U' R' F",
    "U": "y2 U F R U R' U2 F' R U' R' F",
    "U'": "y2 U' F R U R' U2 F' R U' R' F",
    "U2": "y2 U2 F R U R' U2 F' R U' R' F"
  },
  "CLL-U-4": {
    "": "y' F R' F' R U' R U' R' U2 R U' R'",
    "U": "y' U F R' F' R U' R U' R' U2 R U' R'",
    "U'": "y' U' F R' F' R U' R U' R' U2 R U' R'",
    "U2": "y' U2 F R' F' R U' R U' R' U2 R U' R'"
  },
  "CLL-U-5": {
    "": "R U' R2 F R F' R U R' U' R U R'",
    "U": "U R U' R2 F R F' R U R' U' R U R'",
    "U'": "U' R U' R2 F R F' R U R' U' R U R'",
    "U2": "U2 R U' R2 F R F' R U R' U' R U R'"
  },
  "CLL-U-6": {
    "": "R' U R' F R F' R U2 R' U R",
    "U": "U R' U R' F R F' R U2 R' U R",
    "U'": "U' R' U R' F R F' R U2 R' U R",
    "U2": "U2 R' U R' F R F' R U2 R' U R"
  },
  "EG1-AS-1": {
    "": "x2 z U2 B U' R2 F2 U' F",
    "U": "x' z U' B U' R2 F2 U' F",
    "U'": "x z U B U' R2 F2 U' F",
    "U2": "z B U' R2 F2 U' F"
  },
  "EG1-AS-2": {
    "": "U R U' R' F' U' F2 R U' R'",
    "U": "U2 R U' R' F' U' F2 R U' R'",
    "U'": "R U' R' F' U' F2 R U' R'",
    "U2": "U' R U' R' F' U' F2 R U' R'"
  },
  "EG1-AS-3": {
    "": "F' R U R' U' R U R2 F' R",
    "U": "U F' R U R' U' R U R2 F' R",
    "U'": "U' F' R U R' U' R U R2 F' R",
    "U2": "U2 F' R U R' U' R U R2 F' R"
  },
  "EG1-AS-4": {
    "": "R U' R' F' U' R U R' U' F",
    "U": "U R U' R' F' U' R U R' U' F",
    "U'": "U' R U' R' F' U' R U R' U' F",
    "U2": "U2 R U' R' F' U' R U R' U' F"
  },
  "EG1-AS-5": {
    "": "R U R' F' U' R U R' U' R U R'",
    "U": "U R U R' F' U' R U R' U' R U R'",
    "U'": "U' R U R' F' U' R U R' U' R U R'",
    "U2": "U2 R U R' F' U' R U R' U' R U R'"
  },
  "EG1-AS-6": {
    "": "R U' R2 F R U' R' F R F'",
    "U": "U R U' R2 F R U' R' F R F'",
    "U'": "U' R U' R2 F R U' R' F R F'",
    "U2": "U2 R U' R2 F R U' R' F R F'"
  },
  "EG1-H-1": {
    "": "U' R' F R2 U' R' F R U R' F'",
    "U": "R' F R2 U' R' F R U R' F'",
    "U'": "R' F R2 U' R' F R U R' F'",
    "U2": "U R' F R2 U' R' F R U R' F'"
  },
  "EG1-H-2": {
    "": "U' F' U R U' R2 F2 R U' F",
    "U": "F' U R U' R2 F2 R U' F",
    "U'": "F' U R U' R2 F2 R U' F",
    "U2": "U F' U R U' R2 F2 R U' F"
  },
  "EG1-H-3": {
    "": "U R' F R F' U2 F R U2 R' F",
    "U": "U2 R' F R F' U2 F R U2 R' F",
    "U'": "R' F R F' U2 F R U2 R' F",
    "U2": "U' R' F R F' U2 F R U2 R' F"
  },
  "EG1-H-4": {
    "": "U' R U R' F' R U R' U' R U R' U'",
    "U": "R U R' F' R U R' U' R U R' U'",
    "U'": "U2 R U R' F' R U R' U' R U R' U'",
    "U2": "U R U R' F' R U R' U' R U R' U'"
  },
  "EG1-L-1": {
    "": "R U' R' U R U' R2 F' R F",
    "U": "U R U' R' U R U' R2 F' R F",
    "U'": "U' R U' R' U R U' R2 F' R F",
    "U2": "U2 R U' R' U R U' R2 F' R F"
  },
  "EG1-L-2": {
    "": "U' R' F R U' R' F R2 U R' F' U2",
    "U": "R' F R U' R' F R2 U R' F' U2",
    "U'": "U2 R' F R U' R' F R2 U R' F' U2",
    "U2": "U R' F R U' R' F R2 U R' F' U2"
  },
  "EG1-L-3": {
    "": "R' U R2 U' R2 U' F R2 U' R'",
    "U": "U R' U R2 U' R2 U' F R2 U' R'",
    "U'": "U' R' U R2 U' R2 U' F R2 U' R'",
    "U2": "U2 R' U R2 U' R2 U' F R2 U' R'"
  },
  "EG1-L-4": {
    "": "R' F R2 U R' F' R U2 R'",
    "U": "U R' F R2 U R' F' R U2 R'",
    "U'": "U' R' F R2 U R' F' R U2 R'",
    "U2": "U2 R' F R2 U R' F' R U2 R'"
  },
  "EG1-L-5": {
    "": "R U R' F' R U R' U' F R' F' R",
    "U": "U R U R' F' R U R' U' F R' F' R",
    "U'": "U' R U R' F' R U R' U' F R' F' R",
    "U2": "U2 R U R' F' R U R' U' F R' F' R"
  },
  "EG1-L-6": {
    "": "R' U2 F R U2 R U' R2 F",
    "U": "U R' U2 F R U2 R U' R2 F",
    "U'": "U' R' U2 F R U2 R U' R2 F",
    "U2": "U2 R' U2 F R U2 R U' R2 F"
  },
  "EG1-Pi-1": {
    "": "y2 U' F U' R' F R U' F2 R U R'",
    "U": "y2 F U' R' F R U' F2 R U R'",
    "U'": "y2 U2 F U' R' F R U' F2 R U R'",
    "U2": "y2 U F U' R' F R U' F2 R U R'"
  },
  "EG1-Pi-2": {
    "": "y' R U' R2 F R2 U' R'",
    "U": "y' U R U' R2 F R2 U' R'",
    "U'": "y' U' R U' R2 F R2 U' R'",
    "U2": "y' U2 R U' R2 F R2 U' R'"
  },
  "EG1-Pi-3": {
    "": "F R' F U' F2 R U R",
    "U": "U F R' F U' F2 R U R",
    "U'": "U' F R' F U' F2 R U R",
    "U2": "U2 F R' F U' F2 R U R"
  },
  "EG1-Pi-4": {
    "": "R U' R' U R U' R' F R U' R'",
    "U": "U R U' R' U R U' R' F R U' R'",
    "U'": "U' R U' R' U R U' R' F R U' R'",
    "U2": "U2 R U' R' U R U' R' F R U' R'"
  },
  "EG1-Pi-5": {
    "": "R U' R2 F R U R U' R' U' R' F R F'",
    "U": "U R U' R2 F R U R U' R' U' R' F R F'",
    "U'": "U' R U' R2 F R U R U' R' U' R' F R F'",
    "U2": "U2 R U' R2 F R U R U' R' U' R' F R F'"
  },
  "EG1-Pi-6": {
    "": "U' R' F' R U' R' F R2 U R' F' R U R'",
    "U": "R' F' R U' R' F R2 U R' F' R U R'",
    "U'": "U2 R' F' R U' R' F R2 U R' F' R U R'",
    "U2": "U R' F' R U' R' F R2 U R' F' R U R'"
  },
  "EG1-S-1": {
    "": "U' L F' L2 U' L F U L' U L",
    "U": "L F' L2 U' L F U L' U L",
    "U'": "U2 L F' L2 U' L F U L' U L",
    "U2": "U L F' L2 U' L F U L' U L"
  },
  "EG1-S-2": {
    "": "R U R' F2 U F R U R'",
    "U": "U R U R' F2 U F R U R'",
    "U'": "U' R U R' F2 U F R U R'",
    "U2": "U2 R U R' F2 U F R U R'"
  },
  "EG1-S-3": {
    "": "F R' F' R U R' F' R2 U R'",
    "U": "U F R' F' R U R' F' R2 U R'",
    "U'": "U' F R' F' R U R' F' R2 U R'",
    "U2": "U2 F R' F' R U R' F' R2 U R'"
  },
  "EG1-S-4": {
    "": "U F' R' F R2 U R' U' F R' F' R U",
    "U": "U2 F' R' F R2 U R' U' F R' F' R U",
    "U'": "F' R' F R2 U R' U' F R' F' R U",
    "U2": "U' F' R' F R2 U R' U' F R' F' R U"
  },
  "EG1-S-5": {
    "": "R U' R' U R U' R' U F R U' R'",
    "U": "U R U' R' U R U' R' U F R U' R'",
    "U'": "U' R U' R' U R U' R' U F R U' R'",
    "U2": "U2 R U' R' U R U' R' U F R U' R'"
  },
  "EG1-S-6": {
    "": "R' F R2 U' R' U R U' R' F",
    "U": "U R' F R2 U' R' U R U' R' F",
    "U'": "U' R' F R2 U' R' U R U' R' F",
    "U2": "U2 R' F R2 U' R' U R U' R' F"
  },
  "EG1-T-1": {
    "": "F R U' R2 F' R U R' F' R",
    "U": "U F R U' R2 F' R U R' F' R",
    "U'": "U' F R U' R2 F' R U R' F' R",
    "U2": "U2 F R U' R2 F' R U R' F' R"
  },
  "EG1-T-2": {
    "": "F' R' F R2 U R' U' R U R'",
    "U": "U F' R' F R2 U R' U' R U R'",
    "U'": "U' F' R' F R2 U R' U' R U R'",
    "U2": "U2 F' R' F R2 U R' U' R U R'"
  },
  "EG1-T-3": {
    "": "R U' R2 F R U R U2 R'",
    "U": "U R U' R2 F R U R U2 R'",
    "U'": "U' R U' R2 F R U R U2 R'",
    "U2": "U2 R U' R2 F R U R U2 R'"
  },
  "EG1-T-4": {
    "": "U2 R' F R F' U R U' R' U F R U' R'",
    "U": "U' R' F R F' U R U' R' U F R U' R'",
    "U'": "U R' F R F' U R U' R' U F R U' R'",
    "U2": "R' F R F' U R U' R' U F R U' R'"
  },
  "EG1-T-5": {
    "": "R' F' R2 U R' F' R U R'",
    "U": "U R' F' R2 U R' F' R U R'",
    "U'": "U' R' F' R2 U R' F' R U R'",
    "U2": "U2 R' F' R2 U R' F' R U R'"
  },
  "EG1-T-6": {
    "": "U' R U' R' U2 F R U2 R' F",
    "U": "R U' R' U2 F R U2 R' F",
    "U'": "U2 R U' R' U2 F R U2 R' F",
    "U2": "U R U' R' U2 F R U2 R' F"
  },
  "EG1-U-1": {
    "": "y U2 R U R' U R U' R2 F' R2 U R' U",
    "U": "y U' R U R' U R U' R2 F' R2 U R' U",
    "U'": "y U R U R' U R U' R2 F' R2 U R' U",
    "U2": "y R U R' U R U' R2 F' R2 U R' U"
  },
  "EG1-U-2": {
    "": "U2 y R' U R' U' R U' R' U' F2 R2",
    "U": "U' y R' U R' U' R U' R' U' F2 R2",
    "U'": "U y R' U R' U' R U' R' U' F2 R2",
    "U2": "y R' U R' U' R U' R' U' F2 R2"
  },
  "EG1-U-3": {
    "": "F' U2 R U2 R' U2 F",
    "U": "U F' U2 R U2 R' U2 F",
    "U'": "U' F' U2 R U2 R' U2 F",
    "U2": "U2 F' U2 R U2 R' U2 F"
  },
  "EG1-U-4": {
    "": "R' F R F' R' F R2 U' R'",
    "U": "U R' F R F' R' F R2 U' R'",
    "U'": "U' R' F R F' R' F R2 U' R'",
    "U2": "U2 R' F R F' R' F R2 U' R'"
  },
  "EG1-U-5": {
    "": "U2 R U' R' U R U' R' U' F R U' R'",
    "U": "U' R U' R' U R U' R' U' F R U' R'",
    "U'": "U R U' R' U R U' R' U' F R U' R'",
    "U2": "R U' R' U R U' R' U' F R U' R'"
  },
  "EG1-U-6": {
    "": "R' F R U' R' F R U' R U R' F' U2",
    "U": "U R' F R U' R' F R U' R U R' F' U2",
    "U'": "U' R' F R U' R' F R U' R U R' F' U2",
    "U2": "U2 R' F R U' R' F R U' R U R' F' U2"
  },
  "EG2-AS-1": {
    "": "F R2 U R' U2 R U R2 U F'",
    "U": "U F R2 U R' U2 R U R2 U F'",
    "U'": "U' F R2 U R' U2 R U R2 U F'",
    "U2": "U2 F R2 U R' U2 R U R2 U F'"
  },
  "EG2-AS-2": {
    "": "R' U' R U' R' U2 R' F2 R2",
    "U": "U R' U' R U' R' U2 R' F2 R2",
    "U'": "U' R' U' R U' R' U2 R' F2 R2",
    "U2": "U2 R' U' R U' R' U2 R' F2 R2"
  },
  "EG2-AS-3": {
    "": "U2 R' F R F' R U R B2 R2",
    "U": "U' R' F R F' R U R B2 R2",
    "U'": "U R' F R F' R U R B2 R2",
    "U2": "R' F R F' R U R B2 R2"
  },
  "EG2-AS-4": {
    "": "U2 F' L F L' U2 L' U2 L' B2 L2",
    "U": "U' F' L F L' U2 L' U2 L' B2 L2",
    "U'": "U F' L F L' U2 L' U2 L' B2 L2",
    "U2": "F' L F L' U2 L' U2 L' B2 L2"
  },
  "EG2-AS-5": {
    "": "y2 F R F' U R2 F' R U' R",
    "U": "y2 U F R F' U R2 F' R U' R",
    "U'": "y2 U' F R F' U R2 F' R U' R",
    "U2": "y2 U2 F R F' U R2 F' R U' R"
  },
  "EG2-AS-6": {
    "": "y2 R2 F2 R F R F' R U R'",
    "U": "y2 U R2 F2 R F R F' R U R'",
    "U'": "y2 U' R2 F2 R F R F' R U R'",
    "U2": "y2 U2 R2 F2 R F R F' R U R'"
  },
  "EG2-H-1": {
    "": "R2 F U2 F2 R2 F' R2",
    "U": "U R2 F U2 F2 R2 F' R2",
    "U'": "U' R2 F U2 F2 R2 F' R2",
    "U2": "R2 F U2 F2 R2 F' R2"
  },
  "EG2-H-2": {
    "": "y R2 B2 U2 R' U2 R2",
    "U": "y U R2 B2 U2 R' U2 R2",
    "U'": "y U' R2 B2 U2 R' U2 R2",
    "U2": "y U2 R2 B2 U2 R' U2 R2"
  },
  "EG2-H-3": {
    "": "R' U' R U2 R2 F' R U' F R",
    "U": "U R' U' R U2 R2 F' R U' F R",
    "U'": "U' R' U' R U2 R2 F' R U' F R",
    "U2": "U2 R' U' R U2 R2 F' R U' F R"
  },
  "EG2-H-4": {
    "": "y' R U2 B2 R' U R U' B R'",
    "U": "y' U R U2 B2 R' U R U' B R'",
    "U'": "y' U' R U2 B2 R' U R U' B R'",
    "U2": "y' U2 R U2 B2 R' U R U' B R'"
  },
  "EG2-L-1": {
    "": "x2 y z y' x U L2 B2 L U' L' U L F' L F",
    "U": "x2 y z y' x U2 L2 B2 L U' L' U L F' L F",
    "U'": "x2 y z y' x L2 B2 L U' L' U L F' L F",
    "U2": "x2 y z y' x U' L2 B2 L U' L' U L F' L F"
  },
  "EG2-L-2": {
    "": "y2 F2 R2 F R U R' U' R' F R",
    "U": "y2 U F2 R2 F R U R' U' R' F R",
    "U'": "y2 U' F2 R2 F R U R' U' R' F R",
    "U2": "y2 U2 F2 R2 F R U R' U' R' F R"
  },
  "EG2-L-3": {
    "": "y2 R2 U' R U2 R' U2 R U' F2 R2",
    "U": "y2 U R2 U' R U2 R' U2 R U' F2 R2",
    "U'": "y2 U' R2 U' R U2 R' U2 R U' F2 R2",
    "U2": "y2 U2 R2 U' R U2 R' U2 R U' F2 R2"
  },
  "EG2-L-4": {
    "": "z' x z' x2 R' U L' U2 R' F R U' R' U' F' x2",
    "U": "z' x z' x2 U R' U L' U2 R' F R U' R' U' F' x2",
    "U'": "z' x z' x2 U' R' U L' U2 R' F R U' R' U' F' x2",
    "U2": "z' x z' x2 U2 R' U L' U2 R' F R U' R' U' F' x2"
  },
  "EG2-L-5": {
    "": "x2 z2 F R' F' R U R U' R B2 R2",
    "U": "x2 z2 U F R' F' R U R U' R B2 R2",
    "U'": "x2 z2 U' F R' F' R U R U' R B2 R2",
    "U2": "x2 z2 U2 F R' F' R U R U' R B2 R2"
  },
  "EG2-L-6": {
    "": "F' R U R' U' R' F R' F2 R2",
    "U": "U F' R U R' U' R' F R' F2 R2",
    "U'": "U' F' R U R' U' R' F R' F2 R2",
    "U2": "U2 F' R U R' U' R' F R' F2 R2"
  },
  "EG2-Pi-1": {
    "": "F U' R U2 R U' R' U R' F'",
    "U": "U F U' R U2 R U' R' U R' F'",
    "U'": "U' F U' R U2 R U' R' U R' F'",
    "U2": "U2 F U' R U2 R U' R' U R' F'"
  },
  "EG2-Pi-2": {
    "": "R U2 R2 U R' F2 R2 F'",
    "U": "U R U2 R2 U R' F2 R2 F'",
    "U'": "U' R U2 R2 U R' F2 R2 F'",
    "U2": "U2 R U2 R2 U R' F2 R2 F'"
  },
  "EG2-Pi-3": {
    "": "U F R2 U' R2 U R2 U R2 F R2 F2 U2",
    "U": "U2 F R2 U' R2 U R2 U R2 F R2 F2 U2",
    "U'": "F R2 U' R2 U R2 U R2 F R2 F2 U2",
    "U2": "U' F R2 U' R2 U R2 U R2 F R2 F2 U2"
  },
  "EG2-Pi-4": {
    "": "y2 R' F R F' R U' R' U' R U' R F2 R2",
    "U": "y2 U R' F R F' R U' R' U' R U' R F2 R2",
    "U'": "y2 U' R' F R F' R U' R' U' R U' R F2 R2",
    "U2": "y2 U2 R' F R F' R U' R' U' R U' R F2 R2"
  },
  "EG2-Pi-5": {
    "": "U' R' F' R' F2 R2 U R' U2 R U",
    "U": "R' F' R' F2 R2 U R' U2 R U",
    "U'": "U2 R' F' R' F2 R2 U R' U2 R U",
    "U2": "U R' F' R' F2 R2 U R' U2 R U"
  },
  "EG2-Pi-6": {
    "": "U R' U2 R U' R2 F2 R F R U'",
    "U": "U2 R' U2 R U' R2 F2 R F R U'",
    "U'": "R' U2 R U' R2 F2 R F R U'",
    "U2": "U' R' U2 R U' R2 F2 R F R U'"
  },
  "EG2-S-1": {
    "": "R2 F2 R U R U' R' F R' F' R2 U R' U' R",
    "U": "U R2 F2 R U R U' R' F R' F' R2 U R' U' R",
    "U'": "U' R2 F2 R U R U' R' F R' F' R2 U R' U' R",
    "U2": "U2 R2 F2 R U R U' R' F R' F' R2 U R' U' R"
  },
  "EG2-S-2": {
    "": "x2 z2 R U R' U R U2 R B2 R2",
    "U": "x2 z2 U R U R' U R U2 R B2 R2",
    "U'": "x2 z2 U' R U R' U R U2 R B2 R2",
    "U2": "x2 z2 U2 R U R' U R U2 R B2 R2"
  },
  "EG2-S-3": {
    "": "R U' R' F R' F' R' F2 R2",
    "U": "U R U' R' F R' F' R' F2 R2",
    "U'": "U' R U' R' F R' F' R' F2 R2",
    "U2": "U2 R U' R' F R' F' R' F2 R2"
  },
  "EG2-S-4": {
    "": "x2 z2 F R' F' R U2 R U2 R B2 R2",
    "U": "x2 z2 U F R' F' R U2 R U2 R B2 R2",
    "U'": "x2 z2 U' F R' F' R U2 R U2 R B2 R2",
    "U2": "x2 z2 U2 F R' F' R U2 R U2 R B2 R2"
  },
  "EG2-S-5": {
    "": "R' U R' F R2 U' F R' F'",
    "U": "U R' U R' F R2 U' F R' F'",
    "U'": "U' R' U R' F R2 U' F R' F'",
    "U2": "U2 R' U R' F R2 U' F R' F'"
  },
  "EG2-S-6": {
    "": "R2 B2 R' U' R' F R' F' R",
    "U": "U R2 B2 R' U' R' F R' F' R",
    "U'": "U' R2 B2 R' U' R' F R' F' R",
    "U2": "U2 R2 B2 R' U' R' F R' F' R"
  },
  "EG2-T-1": {
    "": "U R' F' R U R U' R' F' R2 B2 U",
    "U": "U2 R' F' R U R U' R' F' R2 B2 U",
    "U'": "R' F' R U R U' R' F' R2 B2 U",
    "U2": "U' R' F' R U R U' R' F' R2 B2 U"
  },
  "EG2-T-2": {
    "": "y' F U' R2 U' R' U R2 F'",
    "U": "y' U F U' R2 U' R' U R2 F'",
    "U'": "y' U' F U' R2 U' R' U R2 F'",
    "U2": "y' U2 F U' R2 U' R' U R2 F'"
  },
  "EG2-T-3": {
    "": "R' U R U2 R2 F' R U' R",
    "U": "U R' U R U2 R2 F' R U' R",
    "U'": "U' R' U R U2 R2 F' R U' R",
    "U2": "U2 R' U R U2 R2 F' R U' R"
  },
  "EG2-T-4": {
    "": "R2 F2 R U' F R' F' R U R",
    "U": "U R2 F2 R U' F R' F' R U R",
    "U'": "U' R2 F2 R U' F R' F' R U R",
    "U2": "U2 R2 F2 R U' F R' F' R U R"
  },
  "EG2-T-5": {
    "": "y' R' U2 R U' R' F R' F R F' R",
    "U": "y' U R' U2 R U' R' F R' F R F' R",
    "U'": "y' U' R' U2 R U' R' F R' F R F' R",
    "U2": "y' U2 R' U2 R U' R' F R' F R F' R"
  },
  "EG2-T-6": {
    "": "y R' U2 R' F2 R F2 R",
    "U": "y U R' U2 R' F2 R F2 R",
    "U'": "y U' R' U2 R' F2 R F2 R",
    "U2": "y U2 R' U2 R' F2 R F2 R"
  },
  "EG2-U-1": {
    "": "R2 U2 R U R' U F' R U' R",
    "U": "U R2 U2 R U R' U F' R U' R",
    "U'": "U' R2 U2 R U R' U F' R U' R",
    "U2": "U2 R2 U2 R U R' U F' R U' R"
  },
  "EG2-U-2": {
    "": "x y z x2 z2 F R U R' U' F R2 B2",
    "U": "x y z x2 z2 U F R U R' U' F R2 B2",
    "U'": "x y z x2 z2 U' F R U R' U' F R2 B2",
    "U2": "x y z x2 z2 U2 F R U R' U' F R2 B2"
  },
  "EG2-U-3": {
    "": "R' F' U' R U2 R' U F R",
    "U": "U R' F' U' R U2 R' U F R",
    "U'": "U' R' F' U' R U2 R' U F R",
    "U2": "U2 R' F' U' R U2 R' U F R"
  },
  "EG2-U-4": {
    "": "R' F' U' F U2 L' U2 R U' L",
    "U": "U R' F' U' F U2 L' U2 R U' L",
    "U'": "U' R' F' U' F U2 L' U2 R U' L",
    "U2": "U2 R' F' U' F U2 L' U2 R U' L"
  },
  "EG2-U-5": {
    "": "y2 R2 B2 R' U R' U' R' F R F'",
    "U": "y2 U R2 B2 R' U R' U' R' F R F'",
    "U'": "y2 U' R2 B2 R' U R' U' R' F R F'",
    "U2": "y2 U2 R2 B2 R' U R' U' R' F R F'"
  },
  "EG2-U-6": {
    "": "y2 R2 F2 R F' R U L F' L' F",
    "U": "y2 U R2 F2 R F' R U L F' L' F",
    "U'": "y2 U' R2 F2 R F' R U L F' L' F",
    "U2": "y2 U2 R2 F2 R F' R U L F' L' F"
  }
};
