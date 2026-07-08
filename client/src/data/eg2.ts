import type { AlgSet } from './algTypes';

export const EG2_SET: AlgSet = {
  id: 'EG2',
  name: 'EG2',
  kind: 'eg2',
  description: 'EG-2: Bottom layer has two solved corners (2×2)',
  cases: [
    // Anti-Sune
    { id: 'EG2-AS-1', name: 'EG2 AS 1', group: 'Anti-Sune', moves: "F R2 U R' U2 R U R2 U F'", alts: ["U2 R' U2 R2 U' R' U R' F R F R2", "x U' R2 F R2 F' U R' U2 R' U x'", "R U2 R' F R' F' R U' R U' R F2 R2", "R U2 R' F R' F' R U' R U' R B2 R2", "y2 R' U R U' R2 F R F' R U R' U' R' F2 R2", "U2 F R2 U2 R' U R' U2 R U' F'"] },
    { id: 'EG2-AS-2', name: 'EG2 AS 2', group: 'Anti-Sune', moves: "R' U' R U' R' U2 R' F2 R2", alts: ["y2 L' U' L U' L' U2 L' F2 R2", "U2 R' F' R U' R' F2 R' F2 R2", "y R U2 R' U' R U' R B2 R2", "y R2 B2 R' U2 R' U' R U' R'", "R2 F2 R U' R U' R' U2 R"] },
    { id: 'EG2-AS-3', name: 'EG2 AS 3', group: 'Anti-Sune', moves: "U2 R' F R F' R U R B2 R2", alts: ["U2 L' U R U' L U R B2 R2", "y2 L' U L F' R U R B2 R2", "U2 L' U L F2 L2 F R U R'"] },
    { id: 'EG2-AS-4', name: 'EG2 AS 4', group: 'Anti-Sune', moves: "U2 F' L F L' U2 L' U2 L' B2 L2", alts: ["y' R' U R' F R2 F R2 F'", "y2 F' R U R' U2 R' F2 R' F2 R2", "y' R' U L' U R2 U R2 U'", "R2 B2 R' U2 R' U2 R' F R F'"] },
    { id: 'EG2-AS-5', name: 'EG2 AS 5', group: 'Anti-Sune', moves: "y2 F R F' U R2 F' R U' R", alts: ["R' U' R U' R' U' R' F2 R F' R", "y2 R U2 R' U2 R' F R F R2 F2"] },
    { id: 'EG2-AS-6', name: 'EG2 AS 6', group: 'Anti-Sune', moves: "y2 R2 F2 R F R F' R U R'", alts: ["R2 F2 R U L U' R U L'", "y R U2 R' U' R U' R F2 R U R' F2 R F' R' F2 R2", "y2 L' U' L U L F' L' F L' U' L U' L' U2 L' B2 L2", "y R U R2 F' R F R U' R2 F R' F2 R2"] },
    // H
    { id: 'EG2-H-1', name: 'EG2 H 1', group: 'H', moves: "R2 F U2 F2 R2 F' R2", alts: ["R U' R' F R' F' R2 U' R' F R' F' R' F2 R2", "U F R U R' U' R U R' U' R U R' U' F' R2 F2 R2 U'", "y F2 R U2 R2 F2 R' F2", "U x' U2 R U2 R2 F2 R' U2 x"] },
    { id: 'EG2-H-2', name: 'EG2 H 2', group: 'H', moves: "y R2 B2 U2 R' U2 R2", alts: ["y R2 U2 R U2 B2 R2", "y R2 U2 R U2 F2 R2", "U R2 U2 R' U2 F2 R2", "y R2 U2 R' U2 F2 R2", "y R2 F2 U2 R U2 R2"] },
    { id: 'EG2-H-3', name: 'EG2 H 3', group: 'H', moves: "R' U' R U2 R2 F' R U' F R", alts: ["y R' U' F R U' R U R' U2 R' F", "y2 R U R' U R U R' F R' F' R' F2 R2", "U2 R U R' U R U R' F R' F' R' F2 R2", "R U' R2 U' F U' F U' R2 F R"] },
    { id: 'EG2-H-4', name: 'EG2 H 4', group: 'H', moves: "y' R U2 B2 R' U R U' B R'", alts: ["y2 F R2 U' R2 U' R2 U R2 F R2 F2", "U2 F R2 U' R2 U' R2 U R2 F B2 R2 F2 R2 U2", "y R U' R' F U2 R2 F' R F' R", "U2 F R2 U' R2 U' R2 U R2 F R2 F2 U'", "y' R U2 B2 R' U R U' F U' x'"] },
    // L
    { id: 'EG2-L-1', name: 'EG2 L 1', group: 'L', moves: "U L2 B2 L U' L' U L F' L F", alts: ["y R2 B2 R2 F R' F' R U R U' R'", "y R' U' R' F' R U' R U' R' F R", "y F R' F' R U R U' R' U' R' F R' F2 R U' R"] },
    { id: 'EG2-L-2', name: 'EG2 L 2', group: 'L', moves: "y2 F2 R2 F R U R' U' R' F R", alts: ["y2 R2 B2 R' U R U' R' F R' F'", "U2 F' R U R' U' R' F R U R' F R' F2 R U' R", "y2 R2 F2 R2 F' R U R' U' R' F R", "R U' R' U R U' R' F R' F' R2 U R B2 R2"] },
    { id: 'EG2-L-3', name: 'EG2 L 3', group: 'L', moves: "y2 R2 U' R U2 R' U2 R U' F2 R2", alts: ["y R' U' F2 R U2 R' U2 F R", "y2 R2 F2 R U R' U2 R U' R' U R U' R2", "U2 F' R U R' U' R' F2 R' F2 R U' R", "y2 R' U R' U2 R U' R' U R U' B2 R2"] },
    { id: 'EG2-L-4', name: 'EG2 L 4', group: 'L', moves: "y' R' U L' U2 R' F R U' R' U' F' x2", alts: ["y R U2 R2 F R F' R U2 R B2 R2", "y' R' U' R U R' F' R U R' U' R' F' R2"] },
    { id: 'EG2-L-5', name: 'EG2 L 5', group: 'L', moves: "y F R' F' R U R U' R B2 R2", },
    { id: 'EG2-L-6', name: 'EG2 L 6', group: 'L', moves: "y2 F' R U R' U' R' F R' F2 R2", alts: ["R U R U' R' F R' F R2 B2", "y F R U' R' U' R U R' F R2 B2"] },
    // Pi
    { id: 'EG2-Pi-1', name: 'EG2 Pi 1', group: 'Pi', moves: "F U' R U2 R U' R' U R' F'", alts: ["y' R' U' R' F R F' R U' R' U2 R' F2 R2", "y' F2 U' F2 R U2 R F2 U' R2", "R' F' U' F U' R U R' U R' F2 R2 U'"] },
    { id: 'EG2-Pi-2', name: 'EG2 Pi 2', group: 'Pi', moves: "R U2 R2 U R' F2 R2 F'", alts: ["R U' R2 U R2 U R2 U' R' F2 R2", "R' U2 R2 U' R' F2 R2 F'", "F R U R' U' R U R' U' F R2 B2", "R' U R2 U' R2 U' R2 U R B2 R2", "R U2 R2 U' R2 U' R2 U2 R' F2 R2"] },
    { id: 'EG2-Pi-3', name: 'EG2 Pi 3', group: 'Pi', moves: "U F R2 U' R2 U R2 U R2 F R2 F2 U2", alts: ["y2 R' F' U R' F R2 U2 R' U R", "y' R U' R U' R' U R' F R2 F R2 F2", "y' R U' R U' R' U R' F R2 F' R2 F2 R2"] },
    { id: 'EG2-Pi-4', name: 'EG2 Pi 4', group: 'Pi', moves: "y2 R' F R F' R U' R' U' R U' R F2 R2", alts: ["U R U' F U' F' R F2 U2 R' U", "R U' R' F L' U L U R' F R' F2 R2", "R U' R' F R' F R U R' F R' F2 R2 U2", "y R' F U' R U R' F2 U2 R", "y R U' F U' F' R F2 U2 R'"] },
    { id: 'EG2-Pi-5', name: 'EG2 Pi 5', group: 'Pi', moves: "U' R' F' R' F2 R2 U R' U2 R U", alts: ["y' R' F' R' F2 R2 U R' U2 R", "U F U R U' R' U R U' R2 F' R U R U' R F2 R2 U'", "y2 L' U2 L U L' U' L U2 L F' L' F' L2 B2", "y F R' F' R U2 R U' R' U R U2 R B2 R2", "y' R' F' R U' R2 F2 R U2 R", "y' R U2 R F2 R2 U' R U' R'", "y R' U' R' F2 R2 U R' F2 R"] },
    { id: 'EG2-Pi-6', name: 'EG2 Pi 6', group: 'Pi', moves: "U R' U2 R U' R2 F2 R F R U'", alts: ["y R' U2 R U' R2 F2 R F R", "R U2 R' U' R U R' U2 R' F R F' R2 F2 R2", "R U2 R' U' R U R' U2 R' F R F' R2 B2 R2", "R U R' U' R' F R2 U R' U' R U R' U' F R2 F2", "y R' U2 R' F2 R2 U R' F R", "y' R U R F2 R2 U' R U2 R'"] },
    // Sune
    { id: 'EG2-S-1', name: 'EG2 S 1', group: 'Sune', moves: "R2 F2 R U R U' R' F R' F' R2 U R' U' R", alts: ["y' R' F R2 F' U' R' U' R2 U R B2 R2", "y' R' F R2 F' U' R' U' R2 U R F2 R2", "y' R' F R2 F' R U2 R' U' F2 R2", "U' F U' R2 U' R' U2 R U' R2 F' U'"] },
    { id: 'EG2-S-2', name: 'EG2 S 2', group: 'Sune', moves: "R U R' U R U2 R B2 R2", alts: ["y' R2 F2 R U2 R U R' U R", "R2 B2 R' U R' U R U2 R'", "y' R' U2 R U R' U R' F2 R2"] },
    { id: 'EG2-S-3', name: 'EG2 S 3', group: 'Sune', moves: "R U' R' F R' F' R' F2 R2", alts: ["R U' R' F2 R2 F' L' U' L"] },
    { id: 'EG2-S-4', name: 'EG2 S 4', group: 'Sune', moves: "F R' F' R U2 R U2 R B2 R2", alts: ["y F R2 F' R2 F' R U' R"] },
    { id: 'EG2-S-5', name: 'EG2 S 5', group: 'Sune', moves: "R' U R' F R2 U' F R' F'", alts: ["y2 R' F R' F2 R U R U R' U R", "R' U R' F R2 D' R U' R'", "R' F2 R U2 R U' R' F R2 F2 R2", "R U R' U R U R F2 R' U R'", "R2 B2 R2 F R' F' R U2 R U2 R'"] },
    { id: 'EG2-S-6', name: 'EG2 S 6', group: 'Sune', moves: "R2 B2 R' U' R' F R' F' R", alts: ["R2 B2 R' U' L' U R' U' L", "y2 R U' R U' R' U R' U' F R' F' R2 B2 R2", "R U R' U' R' F R F' R U R' U R U2 R B2 R2"] },
    // T
    { id: 'EG2-T-1', name: 'EG2 T 1', group: 'T', moves: "U R' F' R U R U' R' F' R2 B2 U", diagramPrefix: 'x2', alts: ["R U R' U' F' U' F' L2 B2", "y R' F' R U R U' R' F' R2 F2", "y' F R F' R U R' U' R B2 R2", "y' F R F' U' R' U' R' F2 R2", "U L' U' L U L F' L' F' R2 F2 U"] },
    { id: 'EG2-T-2', name: 'EG2 T 2', group: 'T', moves: "y' F U' R2 U' R' U R2 F'", alts: ["y F R' U2 R' U' R U2 F'", "y' R U R' U' R' F R F' R2 F2 R2", "U F R' U2 R' U' R U2 F' U", "U' R U R' U' R' F R F R2 F2 U'", "y x U' R' F R' F' R U R' U2 R2"] },
    { id: 'EG2-T-3', name: 'EG2 T 3', group: 'T', moves: "R' U R U2 R2 F' R U' R", alts: ["y R' U R' F U' R U R2", "R U2 R' U' R U' R2 U2 R U R' U R' F2 R2 U'", "y2 R' U R' U2 R U2 R' U R2 U' R B2 R2"] },
    { id: 'EG2-T-4', name: 'EG2 T 4', group: 'T', moves: "R2 F2 R U' F R' F' R U R", alts: ["U R U2 R2 F R F' R U' R' U R U2 R F2 R2 U", "y2 R2 B2 R2 F R U R' U' F'", "F2 R2 F U' R' F R F", "F2 R2 F' R U R' U' F'"] },
    { id: 'EG2-T-5', name: 'EG2 T 5', group: 'T', moves: "y' R' U2 R U' R' F R' F R F' R", alts: ["R' U R U2 R2 F R F' R' F2 R2", "y R' F2 R U' R' U R' F R U' R"] },
    { id: 'EG2-T-6', name: 'EG2 T 6', group: 'T', moves: "y R' U2 R' F2 R F2 R", alts: ["U R' U2 R' F2 R F2 R U", "y z' U' R2 U' R2 U R2 U R2 z", "U R' U' F R U2 R' U' F R", "y R U R' U2 R U R' U R' F R F R2 B2", "y R U R' U2 R U R' U R' F R F R2 F2", "U2 F R U R' U' R U' R' U' R U R' F R2 F2 U"] },
    // U
    { id: 'EG2-U-1', name: 'EG2 U 1', group: 'U', moves: "R2 U2 R U R' U F' R U' R", alts: ["y' F U' R U2 R U' R' U2 R' U' F'", "y' R' U R' F U' R U' R U2 R2", "y' R' U R' F U' R U' R' U2 R2", "R' U' R U' R' U2 R2 U R' U R U2 R F2 R2 U'"] },
    { id: 'EG2-U-2', name: 'EG2 U 2', group: 'U', moves: "y' F R U R' U' F R2 B2", diagramPrefix: 'x2', alts: ["U' F R U R' U' F R2 B2 U'", "y F U R U' R' F R2 F2", "y' F R U R' U' F R2 F2"] },
    { id: 'EG2-U-3', name: 'EG2 U 3', group: 'U', moves: "R' F' U' R U2 R' U F R", alts: ["y2 R' U' R U R' F2 R U' R' U R", "R U R' U' R B2 R' U R U' R'", "y' F R' F' R U' R U' R' U2 R U' R F2 R2", "R' F' R U R' U2 R U' R' F R", "y' F R' F' R U' R U' R' U2 R U' R B2 R2", "F R U' R' U R U R' U R U' R' F R2 F2 U'"] },
    { id: 'EG2-U-4', name: 'EG2 U 4', group: 'U', moves: "R' F' U' F U2 L' U2 R U' L", alts: ["y' R2 F2 R U R U2 R2 F R F' R", "y' z' U2 R' U' R2 U' R' U' R U' R B2 R2", "F R U R' U' F R U R' U' F R U R F2 R2 U2"] },
    { id: 'EG2-U-5', name: 'EG2 U 5', group: 'U', moves: "y2 R2 B2 R' U R' U' R' F R F'", alts: ["U2 R2 B2 R' U R' U' R' F R F' U2", "R' U R' F R F' R U2 R' U R' F2 R2", "R' F R2 U' R' F R' F' R U R' F' R' F2 R2"] },
    { id: 'EG2-U-6', name: 'EG2 U 6', group: 'U', moves: "y2 R2 F2 R F' R U L F' L' F", alts: ["y2 R2 B2 R2 F R F' R U R' U' R'", "R U' R2 F R F' R U R' U' R U R F2 R2", "U2 R2 F2 R F' R U R U' R' F U2", "y2 R2 F2 R F' R U R U' R' F"] },
  ],
};
