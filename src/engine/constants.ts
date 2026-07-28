// Balance configurations based on RULES.md

export const BALANCE = {
  5: { moles: 2, teamSizes: [2, 3, 2, 3, 3], twoSabotagesRequiredOnRound: [] as number[] },
  6: { moles: 2, teamSizes: [2, 3, 4, 3, 4], twoSabotagesRequiredOnRound: [] as number[] },
  7: { moles: 3, teamSizes: [2, 3, 3, 4, 4], twoSabotagesRequiredOnRound: [4] },
  8: { moles: 3, teamSizes: [3, 4, 4, 5, 5], twoSabotagesRequiredOnRound: [4] },
};

export const MAX_ROUNDS = 5;
export const WINS_NEEDED = 3;
