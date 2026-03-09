export const TEAM_BATTLE_PANEL_TOTAL = 25;
export const TEAM_BATTLE_TUTORIAL_IMAGE_URL =
  "https://raw.githubusercontent.com/FukaseDaichi/nazomatic-storage/main/img/1.png";
export const TEAM_BATTLE_TUTORIAL_ANSWER = "かたたき";

export const TEAM_BATTLE_PANEL_ORDER = [
  13, 8, 18, 12, 14,
  7, 9, 17, 19, 3,
  23, 11, 15, 21, 25,
  2, 4, 22, 24, 1,
  5, 6, 10, 16, 20,
];

export const clampTeamBattlePanelCount = (count: number) =>
  Math.max(0, Math.min(TEAM_BATTLE_PANEL_TOTAL, Math.round(count)));

export const getTeamBattleHiddenPanels = (count: number) =>
  TEAM_BATTLE_PANEL_ORDER.slice(0, clampTeamBattlePanelCount(count));

export const getTeamBattleOpenPanels = (hiddenPanels: number[]) => {
  const hiddenSet = new Set(hiddenPanels);

  return Array.from({ length: TEAM_BATTLE_PANEL_TOTAL }, (_, index) => index + 1)
    .filter((panelNumber) => !hiddenSet.has(panelNumber));
};
