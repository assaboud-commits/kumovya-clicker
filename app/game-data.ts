import { assetPath } from './asset-path';

export type Upgrade = {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  click: number;
  passive: number;
  position: string;
};

export const upgrades: Upgrade[] = [
  { id: 'pickles', name: 'Огурцы без паспорта', description: 'Рецепт пережил трёх хозяев гаража.', baseCost: 25, click: 1, passive: 0, position: '0% 0%' },
  { id: 'brazier', name: 'Мангал на доверии', description: 'Дымит даже в налоговую.', baseCost: 80, click: 0, passive: 1, position: '100% 0%' },
  { id: 'phone', name: 'Телефон «Решала»', description: 'Все контакты записаны как «Сантехник».', baseCost: 310, click: 0, passive: 4, position: '0% 50%' },
  { id: 'case', name: 'Дипломат наличных', description: 'Деньги пахнут шашлыком. Совпадение.', baseCost: 920, click: 12, passive: 0, position: '100% 50%' },
  { id: 'basin', name: 'Тазик влияния', description: 'Корона районного масштаба.', baseCost: 2600, click: 0, passive: 18, position: '0% 100%' },
  { id: 'cat', name: 'Кот-крыша', description: 'Молчит. Знает всех. Ест по расписанию.', baseCost: 8900, click: 0, passive: 60, position: '100% 100%' },
];

export const ranks = [
  [0, 'Случайный гость'],
  [250, 'Свой человек'],
  [1500, 'Уважаемый кум'],
  [8000, 'Решала района'],
  [35000, 'Крёстный бухгалтерии'],
  [150000, 'Легенда семейного чата'],
] as const;

export const characters = [
  {
    id: 'valera',
    name: 'Кум Валера',
    role: 'Решала у мангала',
    perk: 'Любой тычок даёт на 25% больше авторитета.',
    image: assetPath('game/kum-valera.png'),
    unlockAt: 0,
    clickMultiplier: 1.25,
    passiveMultiplier: 1,
    priceMultiplier: 1,
    eventMultiplier: 1,
    eventChance: .12,
  },
  {
    id: 'viktoria',
    name: 'Кума Виктория',
    role: 'Тамада судного дня',
    perk: 'Каждый 12-й тычок превращается в тост x8.',
    image: assetPath('game/kuma-viktoria.png'),
    unlockAt: 150,
    clickMultiplier: 1,
    passiveMultiplier: 1,
    priceMultiplier: 1,
    eventMultiplier: 1,
    eventChance: .12,
  },
  {
    id: 'sara',
    name: 'Тётя Сара',
    role: 'Админ семейного чата',
    perk: 'Пассивный доход +45%, а мутные события случаются чаще.',
    image: assetPath('game/tetya-sara.png'),
    unlockAt: 600,
    clickMultiplier: 1,
    passiveMultiplier: 1.45,
    priceMultiplier: 1,
    eventMultiplier: 1,
    eventChance: .22,
  },
  {
    id: 'misha',
    name: 'Гопон Миша',
    role: 'Авторитет на корточках',
    perk: '«Ты меня уважаешь?» — и все улучшения на 20% дешевле.',
    image: assetPath('game/gopon-misha.png'),
    unlockAt: 2200,
    clickMultiplier: 1,
    passiveMultiplier: 1,
    priceMultiplier: .8,
    eventMultiplier: 1,
    eventChance: .12,
  },
  {
    id: 'zina',
    name: 'Тётя Зина',
    role: 'Нотариус последней надежды',
    perk: 'Любая сомнительная удача приносит в 2,5 раза больше.',
    image: assetPath('game/tetya-zina.png'),
    unlockAt: 9000,
    clickMultiplier: 1,
    passiveMultiplier: 1,
    priceMultiplier: 1,
    eventMultiplier: 2.5,
    eventChance: .12,
  },
] as const;

export type CharacterId = typeof characters[number]['id'];
export type DistrictId = 'garages' | 'market' | 'council';
export type MissionMetric = 'clicks' | 'earned' | 'upgrades' | 'choices' | 'passive';

export const districts = [
  { id: 'garages', name: 'Гаражи', number: '01', image: assetPath('districts/garages.png'), description: 'Тут каждый замок золотой. Открывается всё равно отвёрткой.', unlockAt: 0, requiredMissions: 0, clickBonus: 1.1, passiveBonus: 1, perk: '+10% к силе тычка' },
  { id: 'market', name: 'Ночной рынок', number: '02', image: assetPath('districts/market.png'), description: 'Огурцы и венки через прилавок. На случай разного послевкусия.', unlockAt: 1200, requiredMissions: 2, clickBonus: 1, passiveBonus: 1.2, perk: '+20% к пассивному доходу' },
  { id: 'council', name: 'Районная управа', number: '03', image: assetPath('districts/council.png'), description: 'Тут даже конец света принимают только с копией заявления.', unlockAt: 6000, requiredMissions: 6, clickBonus: 1.15, passiveBonus: 1.15, perk: '+15% к тычку и пассивному доходу' },
] as const;

export type Mission = {
  id: string; district: DistrictId; title: string; description: string; metric: MissionMetric;
  target: number; reward: number; specialist: CharacterId; success: string;
};
export const missions: Mission[] = [
  { id: 'chair', district: 'garages', title: 'Стул для своего', description: 'Собери сходку. Здесь уважение начинается с того, что тебе вообще вынесли стул.', metric: 'clicks', target: 18, reward: 160, specialist: 'valera', success: 'Стул выдержал. Репутация владельца — тоже.' },
  { id: 'grill', district: 'garages', title: 'Мангал без завещания', description: 'Обзаведись двумя улучшениями. Пусть у соседей будет повод волноваться за колбасу.', metric: 'upgrades', target: 2, reward: 260, specialist: 'valera', success: 'Шашлык официально пережил проверку. Проверку не спрашивали.' },
  { id: 'last-toast', district: 'garages', title: 'Тост, который переживёт всех', description: 'Проведи репетицию праздника. После третьего круга гости начинают писать завещания.', metric: 'clicks', target: 36, reward: 420, specialist: 'viktoria', success: 'Тост закончен. Выжившим выданы слова благодарности.' },
  { id: 'chat-alive', district: 'garages', title: 'Чат живее всех живых', description: 'Наладь пассивный доход: купи мангал или телефон в ларьке и собери поступления.', metric: 'passive', target: 80, reward: 600, specialist: 'sara', success: 'Пока все молчали, чат освоил бюджет. Сара закрепила результат.' },
  { id: 'discount', district: 'market', title: 'Скидка до последнего вздоха', description: 'Заработай авторитет любым способом. Миша должен произвести впечатление на ценники.', metric: 'earned', target: 900, reward: 950, specialist: 'misha', success: 'Ценники снижены. Продавец просит не хвалить его вслух.' },
  { id: 'wreaths', district: 'market', title: 'Венки на открытие', description: 'Разрули два кипиша. Торжественный и траурный отделы снова перепутали заказ.', metric: 'choices', target: 2, reward: 1100, specialist: 'viktoria', success: 'Ленты перевернули. Теперь «Вечная память» — программа лояльности.' },
  { id: 'rent', district: 'market', title: 'Аренда без пульса', description: 'Купи шесть улучшений в ларьке после начала дела. Отчётность вырастет. Бухгалтерия не воскреснет.', metric: 'upgrades', target: 6, reward: 1400, specialist: 'sara', success: 'Ларёк оброс связями. Арендодатель — суевериями.' },
  { id: 'mezzanine', district: 'council', title: 'Антресоль на три этажа', description: 'Разрули три кипиша. У одноэтажного ларька внезапно обнаружился собственный лифт.', metric: 'choices', target: 3, reward: 2100, specialist: 'zina', success: 'Третий этаж признан ошибкой зрения. Лифт продолжает ошибаться.' },
  { id: 'bench-will', district: 'council', title: 'Завещание на лавочку', description: 'Заработай авторитет для общественного проекта. Сидеть на нём пока запрещено.', metric: 'earned', target: 2500, reward: 2800, specialist: 'zina', success: 'Лавочка открыта. Право сидеть наследуется по отдельному акту.' },
  { id: 'inauguration', district: 'council', title: 'Инаугурация без свидетелей', description: 'Закрепи влияние сотней тычков. Микрофон передают только своим.', metric: 'clicks', target: 100, reward: 3500, specialist: 'misha', success: 'Район признал семейку. Кто не признал, просто ещё не в чате.' },
];

export const metricLabels: Record<MissionMetric, string> = {
  clicks: 'Нажатия после старта', earned: 'Заработано после старта', upgrades: 'Куплено улучшений после старта',
  choices: 'Разрешено кипишей после старта', passive: 'Пассивный доход после старта',
};
export const SAVE_KEY = 'kumovya-save-v2';
export const LEGACY_SAVE_KEY = 'kumovya-save-v1';
export const STORY_REWARD = 500;
