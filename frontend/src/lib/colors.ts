// Couleurs de séries : vert = fraise, terre cuite = cerise ; tirets/formes distinguent toujours les séries.
export const SERIES_PALETTE = ["#347A55", "#BF532E", "#547B91", "#A83D36", "#145A3D", "#8A7A3D"];
export const DASHES = ["", "6 4", "2 3", "10 3 2 3", "1 0", "4 2"];
export const CROP_COLOR: Record<string, string> = { strawberry: "#347A55", cherry: "#BF532E" };
export const STRATEGY_COLOR: Record<string, string> = {
  no_tis: "#657068", daily: "#547B91", every_3: "#347A55", every_7: "#BF532E", front_70: "#145A3D", front_100: "#A83D36",
};
export const STRATEGY_ORDER = ["no_tis", "daily", "every_3", "every_7", "front_70", "front_100"];
