import type { AlgSet } from './algTypes';

export const EG1_SET: AlgSet = {
  id: 'EG1',
  name: 'EG1',
  kind: 'eg1',
  description: 'EG-1: Bottom layer has one solved corner (2×2)',
  cases: [
    // Anti-Sune
    { id: 'EG1-AS-1', name: 'EG1 AS 1', group: 'Anti-Sune', moves: "y U2 B U' R2 F2 U' F", diagramPrefix: 'x2', alts: ["y R' F R2 U R' F' U' R U' R'", "y U' L' U' L U' F' L' U L2 F L'", "y L' U L2 F L' F' U' L F' L'"] },
    { id: 'EG1-AS-2', name: 'EG1 AS 2', group: 'Anti-Sune', moves: "U R U' R' F' U' F2 R U' R'", alts: ["U2 L' U' L F2 U' F' L' U' L", "R U' F2 R U2 R U' F", "F R U' R' U R' F' R U F' R U R' U", "U F' L F L' F' L' U L U' L F L'", "R U' F2 R U2 R U' B"] },
    { id: 'EG1-AS-3', name: 'EG1 AS 3', group: 'Anti-Sune', moves: "F' R U R' U' R U R2 F' R", alts: ["U' R U' R' U2 R' F R2 U2 R' F", "F' L F L' U' L F L2 U' L", "F' L F L' U' R U R' L' U' L"] },
    { id: 'EG1-AS-4', name: 'EG1 AS 4', group: 'Anti-Sune', moves: "R U' R' F' U' R U R' U' F", alts: ["U F R U' R2 F' R U F' R U R'", "U' R' F R F' U R U' R2 F' R F", "U2 F U' L' U L U' F' L' U' L", "U F L F' L2 U' L U F' L F L'", "U' R U R' U2 R' F' R F R' F R"] },
    { id: 'EG1-AS-5', name: 'EG1 AS 5', group: 'Anti-Sune', moves: "y' R U R' F' U' R U R' U' R U R'", alts: ["d U2 L' U L U' L' U L U L F L' F'", "y' U2 L' U L U' L' U L U L F L' F'", "y' U2 R' F R U' R' F R U R U R' F'", "y' U' R U F' R U R2 U' R U R'", "y' U2 F' R' F R U R U R' U' R U R'"] },
    { id: 'EG1-AS-6', name: 'EG1 AS 6', group: 'Anti-Sune', moves: "y2 R U' R2 F R U' R' F R F'", alts: ["y2 L F' L2 U L U' L' U L F'"] },
    // H
    { id: 'EG1-H-1', name: 'EG1 H 1', group: 'H', moves: "U' R' F R2 U' R' F R U R' F'", alts: ["U' R' F R2 U' R2 U' F U R", "F' R' F R F R' F' R2 U R'", "U R U' R2 F R F' R' F' R F", "F' R2 F' R F R' U R' U", "U' R' F R' F U F' R2 F'", "U R' F R2 U' R2 U' F U R"] },
    { id: 'EG1-H-2', name: 'EG1 H 2', group: 'H', moves: "U' F' U R U' R2 F2 R U' F", alts: ["y' R2 U' R U' R' U R' U' R U' R2", "F R U' R2 F U' F2 U R", "y' R2 U2 R U' R2 U R2 U' R2 U R2 U R2", "U R U' R' U' R U' R2 F2 R U R U R'", "U F' U R U' R2 F2 R U' F"] },
    { id: 'EG1-H-3', name: 'EG1 H 3', group: 'H', moves: "U R' F R F' U2 F R U2 R' F", alts: ["R' U' R' F2 U F' R F'", "U R U' R' F U2 x U' R' U2 R U'", "U' F U2 R U' R' F2 R' F2 R F'"] },
    { id: 'EG1-H-4', name: 'EG1 H 4', group: 'H', moves: "U' R U R' F' R U R' U' R U R' U'", alts: ["F' U R' F R F' U F2", "U' R U R' F' R U R' U' R U R'", "R' F R F' R' F R U' R' F R F'", "F' U2 F' U R' F' R F'"] },
    // L
    { id: 'EG1-L-1', name: 'EG1 L 1', group: 'L', moves: "y R U' R' U R U' R2 F' R F", alts: ["y U R U R' F' R U2 R' U2 R U R'", "y U F R U' R' F' R U R' F' R U R'"] },
    { id: 'EG1-L-2', name: 'EG1 L 2', group: 'L', moves: "y' U' R' F R U' R' F R2 U R' F' U2", alts: ["y' U' R' F R U' R' F R2 U R' F'", "y' U2 x R' U' R U' R' U' R U' R' U2 R", "y' U' L' U L U' L' U L2 F L' F'", "y' R' F R F' R' F R U R U2 R'"] },
    { id: 'EG1-L-3', name: 'EG1 L 3', group: 'L', moves: "y R' U R2 U' R2 U' F R2 U' R'", },
    { id: 'EG1-L-4', name: 'EG1 L 4', group: 'L', moves: "y R' F R2 U R' F' R U2 R'", alts: ["y R U2 R' F R U' R2 F' R"] },
    { id: 'EG1-L-5', name: 'EG1 L 5', group: 'L', moves: "y2 R U R' F' R U R' U' F R' F' R", alts: ["y2 U' R U R' F' U R U R' U' R U R' U'", "y2 U F' R' F R U' R U R' U' R U R' U'", "y2 L' U L y' R U2 R U' R2"] },
    { id: 'EG1-L-6', name: 'EG1 L 6', group: 'L', moves: "y2 R' U2 F R U2 R U' R2 F", alts: ["y2 U' L' U' L F L' U' L U F' L F L'", "y2 U2 F R U' R' U R' F' R U R' F' R", "y2 R' F' R F U' R' F' R U R' F' R", "y R U' R' U' y R U R2 F' R"] },
    // Pi
    { id: 'EG1-Pi-1', name: 'EG1 Pi 1', group: 'Pi', moves: "y2 U' F U' R' F R U' F2 R U R'", alts: ["y2 F2 R U R' U2 R U R' U' F", "y2 R2 B2 R' U R' U' R U2 R U' R2", "U' R U' R2 F R2 U' R F2 R2 U'", "U' R' F R2 U' R2 F R' F2 R2"] },
    { id: 'EG1-Pi-2', name: 'EG1 Pi 2', group: 'Pi', moves: "y' R U' R2 F R2 U' R'", alts: ["y' R U R2 F' R2 U R'", "y' R' F R2 U' R2 F R", "y R' U R L U' L' R' U R", "y' R U' R' L' U L R U' R'", "y2 U R U R' U' R U2 R U' R2", "y' R' F' R2 U R2 F' R", "y' R U R' L' U' L R U R'"] },
    { id: 'EG1-Pi-3', name: 'EG1 Pi 3', group: 'Pi', moves: "y' F R' F U' F2 R U R", alts: ["y' F' R U2 R' F' U2 F R' F' R"] },
    { id: 'EG1-Pi-4', name: 'EG1 Pi 4', group: 'Pi', moves: "y' R U' R' U R U' R' F R U' R'", alts: ["y' F' R U R' U' R U R' F' R U R'"] },
    { id: 'EG1-Pi-5', name: 'EG1 Pi 5', group: 'Pi', moves: "R U' R2 F R U R U' R' U' R' F R F'", alts: ["U' R U R' U R U' R2 F' R F R' F' R", "R' U' R' F2 U' R U2 F2 R", "U' L F' L' F L F' L2 U' L U L' U L U'", "U' R U' R' F R U' R2 F' R U R' F R", "U2 F' L' U L F' L' U2 L U' F", "U F U' R U2 R' F' R U R' F'"] },
    { id: 'EG1-Pi-6', name: 'EG1 Pi 6', group: 'Pi', moves: "U' R' F' R U' R' F R2 U R' F' R U R'", alts: ["U' R' F R F' R' F R2 U R' U' R U' R'", "F R U' R' F R U2 R' U F'", "U' F R' F' R U R U R' U' R' F' R2 U R'", "U' L' U' L U' L' U L2 F L' F' L F L'", "y' R F R' F' R F R2 F' U R'"] },
    // Sune
    { id: 'EG1-S-1', name: 'EG1 S 1', group: 'Sune', moves: "y2 U' L F' L2 U' L F U L' U L", alts: ["y2 R U R' U F R U' R2 F' R", "y2 U F' R B2 U2 R F' R2", "y U R' F R2 F' R2 U2 R U2", "y2 U' R U' R2 F' R F U R' F R", "y2 U F' L U2 F2 R U' x'"] },
    { id: 'EG1-S-2', name: 'EG1 S 2', group: 'Sune', moves: "R U R' F2 U F R U R'", alts: ["U F R' F' R F R U' R' U R' F' R", "U R' F R F U F2 R' F R"] },
    { id: 'EG1-S-3', name: 'EG1 S 3', group: 'Sune', moves: "y2 F R' F' R U R' F' R2 U R'", alts: ["y2 F L' U' L U L' U' L R U R'", "y2 U R' F R U2 R U' R2 F2 R F'"] },
    { id: 'EG1-S-4', name: 'EG1 S 4', group: 'Sune', moves: "U F' R' F R2 U R' U' F R' F' R U", alts: ["U F' R' F R2 U R' U' F R' F' R", "F' U R U' R' U F R U R'"] },
    { id: 'EG1-S-5', name: 'EG1 S 5', group: 'Sune', moves: "y R U' R' U R U' R' U F R U' R'", alts: ["y U2 R2 F U' R U' R U' B2 U2", "y U2 L' U' L F U L' U' L U L' U' L", "y U2 R2 F U' R U' R U' F2"] },
    { id: 'EG1-S-6', name: 'EG1 S 6', group: 'Sune', moves: "R' F R2 U' R' U R U' R' F", alts: ["L' U L2 F' L' U L F' L' F", "R' F R2 U' R' U L F' L' F"] },
    // T
    { id: 'EG1-T-1', name: 'EG1 T 1', group: 'T', moves: "F R U' R2 F' R U R' F' R", alts: ["F L F' L2 U' L U L' U' L", "U R2 U R U' R2 F R U2 R' F", "U2 R U2 R' U' R' F' R F R' F' R"] },
    { id: 'EG1-T-2', name: 'EG1 T 2', group: 'T', moves: "F' R' F R2 U R' U' R U R'", alts: ["U2 R U2 R' F R U' R' F' R U R'", "U2 R U' R' F R U' R' F R U R' F'"] },
    { id: 'EG1-T-3', name: 'EG1 T 3', group: 'T', moves: "y R U' R2 F R U R U2 R'", alts: ["y R U2 R' U' R' F' R2 U R'", "y U2 R' F R2 U' R' U' R' F2 R", "y U2 L' U L2 F' L' U' L' U2 L U2"] },
    { id: 'EG1-T-4', name: 'EG1 T 4', group: 'T', moves: "y' U2 R' F R F' U R U' R' U F R U' R'", alts: ["y' U' R' U F R2 U' R2 U' F U' R", "y' R2 B2 U' R' U' R U' R' U R'"] },
    { id: 'EG1-T-5', name: 'EG1 T 5', group: 'T', moves: "y' R' F' R2 U R' F' R U R'", alts: ["y' U2 R U R2 F' R F R' F' R", "y' U2 R U R2 F' R F R' F' R U2"] },
    { id: 'EG1-T-6', name: 'EG1 T 6', group: 'T', moves: "y' U' R U' R' U2 F R U2 R' F", alts: ["y' U R' U' R U F2 U' F2 R U R", "y' U R' U' R U F2 U' F2 R U R", "y' R U R' F R U R' F U' R U' R'", "y' U' R U' R' U2 F R U2 R' F U2", "y' U' R' F R2 U R' F' U2 R' F R F'"] },
    // U
    { id: 'EG1-U-1', name: 'EG1 U 1', group: 'U', moves: "y U2 R U R' U R U' R2 F' R2 U R' U", alts: ["y U2 R U R' U R U R2 F R2 U' R'", "y U2 R U' R2 F R2 U R' U' R U' R' U", "y U2 R U R2 F' R2 U' R' U' R U' R'", "y U2 R U R' U R U R' L' U L R U' R'", "U2 R2 U' R' U' R U' R' U R'", "y U2 R U' R2 F R2 U R' U' R U' R'", "R U2 R U2 R U R2"] },
    { id: 'EG1-U-2', name: 'EG1 U 2', group: 'U', moves: "U2 y R' U R' U' R U' R' U' F2 R2", alts: ["U' F R2 B R2 F U F2 R2", "U' F R U' R' F x F' L' U' L' U", "U' R U R' F' U' R U R' U' F R' F' R", "U' F R U' R' F U' F' R' F' R", "U x U' R' U R U' F R U R U'", "U F' R2 F' R2 F' U' F2 R2"] },
    { id: 'EG1-U-3', name: 'EG1 U 3', group: 'U', moves: "F' U2 R U2 R' U2 F", alts: ["U2 R U' R2 F2 R F' U R U R'", "U y' R U R' F R2 F' R U' R'", "R U R' U F' R U R' U' R U R2 F2 R"] },
    { id: 'EG1-U-4', name: 'EG1 U 4', group: 'U', moves: "y R' F R F' R' F R2 U' R'", alts: ["y U2 R U' R' F R U' R2 F R", "y U2 L F' L' F L F' L2 U L"] },
    { id: 'EG1-U-5', name: 'EG1 U 5', group: 'U', moves: "U2 R U' R' U R U' R' U' F R U' R'", alts: ["U R' F R F' U R U' R' F R U' R'", "U2 L F' L' U L F' L' U L' U' L F", "F U' R' F2 R F' U2 F'", "F2 R U2 R' U' F2 U2 F'"] },
    { id: 'EG1-U-6', name: 'EG1 U 6', group: 'U', moves: "y2 R' F R U' R' F R U' R U R' F' U2", alts: ["y2 R' F R2 U' R' U y' R U R'", "y2 U L F' L' F U' L' U L F' L' U L", "y2 U2 F' U L F2 L' F U2 F", "y2 U2 F2 L' U2 L U F2 U2 F U2", "y2 U2 F' U R U2 R' F U2 F"] },
  ],
};
