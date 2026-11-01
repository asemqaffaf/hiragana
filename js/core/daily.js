import { PL, curDay } from './plan.js';
import { DAILY } from '../data/daily.js';

/* the base days a plan day covers; a review day (no base) repeats the words of the day before it */
/** @param {number} day @returns {number[]} */
function dailyBases(day) {
  const P = PL();
  for (let i = Math.min(day, P.length) - 1; i >= 0; i--) if (P[i].base.length) return P[i].base;
  return [1];
}
/** @param {number} day */
export const dailyFor = (day) => dailyBases(day).flatMap((b) => DAILY[b] || []);
export const dailySoFar = () => {
  const first = Math.min(...dailyBases(curDay()));
  return Object.keys(DAILY)
    .filter((b) => +b < first)
    .sort((a, b) => +a - +b)
    .flatMap((b) => DAILY[b]);
};
