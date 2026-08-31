import type { CharacterId, DistrictId, MissionMetric } from './game-data';

export type CampaignMetric = MissionMetric | 'quiet' | 'bold' | 'missions';
export type CampaignRoute = 'quiet' | 'bold';
export type CampaignStage = {
  goals: Partial<Record<CampaignMetric, number>>;
  investment: number;
  reward: number;
  crew?: CharacterId[];
  maxHeat?: number;
  minHeat?: number;
};
export type CampaignChapter = {
  id: string; district: DistrictId; reward: number; unlock?: CharacterId; stages: CampaignStage[];
};

// These are play-session chapters, not calendar gates. No login streaks or forced waits.
export const campaignChapters: CampaignChapter[] = [
  { id: 'garage-oath', district: 'garages', reward: 3500, stages: [
    { goals: { earned: 35000, upgrades: 3 }, investment: 0, reward: 350 },
    { goals: { passive: 70000, quiet: 3 }, investment: 6000, reward: 500, crew: ['sara'] },
    { goals: { earned: 168000, missions: 3 }, investment: 15000, reward: 800, crew: ['valera'], maxHeat: 50 },
  ] },
  { id: 'roof', district: 'garages', reward: 10000, stages: [
    { goals: { earned: 400000, upgrades: 4 }, investment: 30000, reward: 1000 },
    { goals: { passive: 400000, choices: 6 }, investment: 60000, reward: 1600 },
    { goals: { earned: 960000, missions: 4 }, investment: 120000, reward: 2500, crew: ['misha'], maxHeat: 45 },
  ] },
  { id: 'market-crown', district: 'market', reward: 35000, stages: [
    { goals: { earned: 800000, upgrades: 4 }, investment: 80000, reward: 4000 },
    { goals: { passive: 900000, quiet: 6 }, investment: 140000, reward: 5500, crew: ['sara'] },
    { goals: { earned: 1500000, missions: 4 }, investment: 240000, reward: 8000, crew: ['viktoria'], maxHeat: 40 },
  ] },
  { id: 'hell-rent', district: 'market', reward: 85000, unlock: 'azazel', stages: [
    { goals: { earned: 900000, upgrades: 4 }, investment: 180000, reward: 10000 },
    { goals: { passive: 1200000, bold: 8 }, investment: 300000, reward: 15000, minHeat: 70 },
    { goals: { earned: 2000000, missions: 5 }, investment: 525000, reward: 20000, crew: ['zina'], maxHeat: 40 },
  ] },
  { id: 'hut-permit', district: 'council', reward: 180000, unlock: 'yaga', stages: [
    { goals: { earned: 1000000, choices: 10 }, investment: 270000, reward: 25000, crew: ['azazel'] },
    { goals: { passive: 1300000, quiet: 8 }, investment: 390000, reward: 35000 },
    { goals: { earned: 2000000, missions: 5 }, investment: 600000, reward: 45000, crew: ['zina'], maxHeat: 35 },
  ] },
  { id: 'last-election', district: 'council', reward: 400000, stages: [
    { goals: { earned: 1680000, upgrades: 3 }, investment: 495000, reward: 60000, crew: ['yaga'] },
    { goals: { passive: 2520000, choices: 12 }, investment: 770000, reward: 80000 },
    { goals: { earned: 3500000, missions: 6 }, investment: 1320000, reward: 100000, crew: ['viktoria'], maxHeat: 35 },
  ] },
  { id: 'family-apocalypse', district: 'council', reward: 1000000, stages: [
    { goals: { earned: 1800000, upgrades: 3 }, investment: 720000, reward: 140000 },
    { goals: { passive: 2400000, quiet: 12 }, investment: 1080000, reward: 180000, crew: ['yaga'] },
    { goals: { earned: 3600000, missions: 7 }, investment: 1800000, reward: 250000, crew: ['azazel', 'yaga'], maxHeat: 30 },
  ] },
];

export const campaignMetricLabels: Record<CampaignMetric, string> = {
  clicks: 'Нажатия', earned: 'Заработать авторитет', upgrades: 'Купить улучшения',
  choices: 'Разрулить кипиши', passive: 'Собрать пассивный доход',
  quiet: 'Решить кипиши тихо', bold: 'Выбрать показуху', missions: 'Завершить поручения',
};
