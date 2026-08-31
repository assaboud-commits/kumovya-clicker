'use client';

import { type MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { initializeTelegram } from './telegram';

type Upgrade = {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  click: number;
  passive: number;
  position: string;
};

type SaveState = {
  authority: number;
  lifetime: number;
  owned: number[];
  sound: boolean;
  selected: number;
};

type FloatHit = {
  id: number;
  x: number;
  y: number;
  value: number;
};

const upgrades: Upgrade[] = [
  { id: 'pickles', name: 'Огурцы без паспорта', description: 'Рецепт пережил трёх хозяев гаража.', baseCost: 25, click: 1, passive: 0, position: '0% 0%' },
  { id: 'brazier', name: 'Мангал на доверии', description: 'Дымит даже в налоговую.', baseCost: 80, click: 0, passive: 1, position: '100% 0%' },
  { id: 'phone', name: 'Телефон «Решала»', description: 'Все контакты записаны как «Сантехник».', baseCost: 310, click: 0, passive: 4, position: '0% 50%' },
  { id: 'case', name: 'Дипломат наличных', description: 'Деньги пахнут шашлыком. Совпадение.', baseCost: 920, click: 12, passive: 0, position: '100% 50%' },
  { id: 'basin', name: 'Тазик влияния', description: 'Корона районного масштаба.', baseCost: 2600, click: 0, passive: 18, position: '0% 100%' },
  { id: 'cat', name: 'Кот-крыша', description: 'Молчит. Знает всех. Ест по расписанию.', baseCost: 8900, click: 0, passive: 60, position: '100% 100%' },
];

const events = [
  ['Тётя Зина пришла без предупреждения', 66],
  ['Шашлык признан условно съедобным', 35],
  ['Кум продал соседу воздух с дачи', 120],
  ['Кто-то сказал «по одной — и домой»', 88],
  ['Тост без подготовки длился сорок минут', 45],
] as const;

const ranks = [
  [0, 'Случайный гость'],
  [250, 'Свой человек'],
  [1500, 'Уважаемый кум'],
  [8000, 'Решала района'],
  [35000, 'Крёстный бухгалтерии'],
  [150000, 'Легенда семейного чата'],
] as const;

const characters = [
  {
    id: 'valera',
    name: 'Кум Валера',
    role: 'Решала у мангала',
    perk: 'Любой тычок даёт на 25% больше авторитета.',
    image: '/game/kum-valera.png',
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
    image: '/game/kuma-viktoria.png',
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
    image: '/game/tetya-sara.png',
    unlockAt: 600,
    clickMultiplier: 1,
    passiveMultiplier: 1.45,
    priceMultiplier: 1,
    eventMultiplier: 1,
    eventChance: .22,
  },
  {
    id: 'gosha',
    name: 'Кум Гоша',
    role: 'Гаражный экономист',
    perk: 'Все покупки в мутном ларьке на 20% дешевле.',
    image: '/game/kum-gosha.png',
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
    image: '/game/tetya-zina.png',
    unlockAt: 9000,
    clickMultiplier: 1,
    passiveMultiplier: 1,
    priceMultiplier: 1,
    eventMultiplier: 2.5,
    eventChance: .12,
  },
] as const;

const defaultState: SaveState = { authority: 0, lifetime: 0, owned: upgrades.map(() => 0), sound: true, selected: 0 };

function formatNumber(value: number) {
  if (value < 1000) return Math.floor(value).toLocaleString('ru-RU');
  const units = [[1_000_000_000, 'млрд'], [1_000_000, 'млн'], [1_000, 'тыс.']] as const;
  const unit = units.find(([size]) => value >= size)!;
  return `${(value / unit[0]).toLocaleString('ru-RU', { maximumFractionDigits: value >= unit[0] * 100 ? 0 : 1 })} ${unit[1]}`;
}

function priceFor(base: number, count: number) {
  return Math.floor(base * Math.pow(1.72, count));
}

export default function Home() {
  const [game, setGame] = useState<SaveState>(defaultState);
  const [ready, setReady] = useState(false);
  const [saveUnavailable, setSaveUnavailable] = useState(false);
  const [floats, setFloats] = useState<FloatHit[]>([]);
  const [pressed, setPressed] = useState(false);
  const [notice, setNotice] = useState<{ label: string; title: string; bonus: number } | null>(null);
  const [tab, setTab] = useState<'shop' | 'chronicle'>('shop');
  const audioRef = useRef<AudioContext | null>(null);
  const hitId = useRef(0);
  const clicksSinceEvent = useRef(0);
  const characterClicks = useRef(0);

  const activeCharacter = characters[game.selected] ?? characters[0];
  const baseClickPower = useMemo(() => 1 + upgrades.reduce((sum, upgrade, index) => sum + upgrade.click * game.owned[index], 0), [game.owned]);
  const clickPower = Math.max(1, Math.round(baseClickPower * activeCharacter.clickMultiplier));
  const basePassive = useMemo(() => upgrades.reduce((sum, upgrade, index) => sum + upgrade.passive * game.owned[index], 0), [game.owned]);
  const passive = basePassive * activeCharacter.passiveMultiplier;
  const rankIndex = ranks.reduce((result, [threshold], index) => game.lifetime >= threshold ? index : result, 0);
  const rank = ranks[rankIndex];
  const nextRank = ranks[Math.min(rankIndex + 1, ranks.length - 1)];
  const rankProgress = rankIndex === ranks.length - 1 ? 100 : ((game.lifetime - rank[0]) / (nextRank[0] - rank[0])) * 100;

  useEffect(() => {
    try {
      const stored = localStorage.getItem('kumovya-save-v1');
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<SaveState>;
        setGame({
          authority: Number.isFinite(parsed.authority) ? Math.max(0, Number(parsed.authority)) : 0,
          lifetime: Number.isFinite(parsed.lifetime) ? Math.max(0, Number(parsed.lifetime)) : 0,
          owned: Array.isArray(parsed.owned) && parsed.owned.length === upgrades.length ? parsed.owned.map((value) => Number.isSafeInteger(value) && value >= 0 ? value : 0) : defaultState.owned,
          sound: typeof parsed.sound === 'boolean' ? parsed.sound : true,
          selected: Number.isInteger(parsed.selected) && Number(parsed.selected) >= 0 && Number(parsed.selected) < characters.length ? Number(parsed.selected) : 0,
        });
      }
    } catch {
      // Some embedded browsers deny storage; keep the game playable in memory.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem('kumovya-save-v1', JSON.stringify(game));
      setSaveUnavailable(false);
    } catch {
      setSaveUnavailable(true);
    }
  }, [game, ready]);

  useEffect(() => {
    if (ready) initializeTelegram(window.Telegram?.WebApp);
  }, [ready]);

  useEffect(() => {
    if (!passive) return;
    const timer = window.setInterval(() => {
      const amount = passive / 4;
      setGame((current) => ({ ...current, authority: current.authority + amount, lifetime: current.lifetime + amount }));
    }, 250);
    return () => window.clearInterval(timer);
  }, [passive]);

  function playClick() {
    if (!game.sound) return;
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = audioRef.current ?? new AudioContextClass();
      audioRef.current = context;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(118, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(72, context.currentTime + 0.055);
      gain.gain.setValueAtTime(0.045, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.06);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.065);
    } catch {
      // Игра остаётся рабочей, даже если браузер заблокировал звук.
    }
  }

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (!ready) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const id = ++hitId.current;
    characterClicks.current += 1;
    const isToast = activeCharacter.id === 'viktoria' && characterClicks.current % 12 === 0;
    const hitValue = isToast ? clickPower * 8 : clickPower;
    setFloats((current) => [...current.slice(-7), { id, x: event.detail === 0 ? rect.width / 2 : event.clientX - rect.left, y: event.detail === 0 ? rect.height / 2 : event.clientY - rect.top, value: hitValue }]);
    window.setTimeout(() => setFloats((current) => current.filter((item) => item.id !== id)), 800);
    setPressed(true);
    window.setTimeout(() => setPressed(false), 95);
    playClick();
    setGame((current) => ({ ...current, authority: current.authority + hitValue, lifetime: current.lifetime + hitValue }));
    if (isToast) {
      setNotice({ label: 'ТОСТ СУДНОГО ДНЯ', title: 'Все встали. Никто не понял зачем.', bonus: hitValue });
      window.setTimeout(() => setNotice(null), 2600);
    }
    clicksSinceEvent.current += 1;
    if (!isToast && clicksSinceEvent.current >= 12 && Math.random() < activeCharacter.eventChance) {
      clicksSinceEvent.current = 0;
      const [title, baseBonus] = events[Math.floor(Math.random() * events.length)];
      const bonus = Math.floor((baseBonus + clickPower * 3) * activeCharacter.eventMultiplier);
      setGame((current) => ({ ...current, authority: current.authority + bonus, lifetime: current.lifetime + bonus }));
      setNotice({ label: 'СОМНИТЕЛЬНЫЙ УСПЕХ', title, bonus });
      window.setTimeout(() => setNotice(null), 3600);
    }
  }

  function buy(index: number) {
    if (!ready) return;
    setGame((current) => {
      const character = characters[current.selected] ?? characters[0];
      const cost = Math.floor(priceFor(upgrades[index].baseCost, current.owned[index]) * character.priceMultiplier);
      if (current.authority < cost) return current;
      return { ...current, authority: current.authority - cost, owned: current.owned.map((count, itemIndex) => itemIndex === index ? count + 1 : count) };
    });
  }

  return (
    <main className="game-shell">
      <div className="noise" aria-hidden="true" />
      <header className="topbar">
        <div className="brand-block">
          <p className="eyebrow">Семейно-экономический симулятор</p>
          <h1>КУМОВЬЯ</h1>
          <p className="motto">Семья — это святое. Особенно когда всё записано на неё.</p>
        </div>
        <div className="stats-strip" aria-label="Игровая статистика">
          <div className="stat"><span>Авторитет</span><strong>{formatNumber(game.authority)}</strong></div>
          <div className="stat"><span>За тычок</span><strong>+{formatNumber(clickPower)}</strong></div>
          <div className="stat"><span>Само капает</span><strong>{formatNumber(passive)}/сек</strong></div>
          <button className="sound-button" type="button" onClick={() => setGame((current) => ({ ...current, sound: !current.sound }))} aria-label={game.sound ? 'Выключить звук' : 'Включить звук'}>
            {game.sound ? 'ЗВУК: ДА' : 'ЗВУК: НЕТ'}
          </button>
        </div>
      </header>

      <div className="ticker" aria-label="Срочные новости"><span>СРОЧНО</span><p>На районе снова сказали «мы ненадолго». Стулья уже несут из гаража.</p></div>

      <section className="game-grid">
        <section className="scene-card" aria-label={activeCharacter.name}>
          <div className="rank-panel">
            <div><span>Текущий статус</span><strong>{rank[1]}</strong></div>
            <div className="rank-meter" aria-label="Прогресс статуса"><i style={{ width: `${Math.min(100, rankProgress)}%` }} /></div>
            <small>{rankIndex === ranks.length - 1 ? 'Выше только семейный чат' : `До статуса «${nextRank[1]}»: ${formatNumber(Math.max(0, nextRank[0] - game.lifetime))}`}</small>
          </div>

          <div className="character-stage">
            <div className="character-title"><strong>{activeCharacter.name}</strong><span>{activeCharacter.role}</span></div>
            <div className="bad-stamp" aria-hidden="true">СВОЙ<br />ЧЕЛОВЕК</div>
            <button type="button" className={`character-button${pressed ? ' is-pressed' : ''}`} onClick={handleClick} disabled={!ready} aria-label={`Нажать на персонажа ${activeCharacter.name} и получить ${clickPower} авторитета`}>
              <img src={activeCharacter.image} alt={`${activeCharacter.name} — ${activeCharacter.role}`} draggable={false} />
              {floats.map((item) => <span className="float-hit" key={item.id} style={{ left: item.x, top: item.y }}>+{formatNumber(item.value)}</span>)}
            </button>
            <div className="click-plate"><span>ДАВИ НА СВЯЗИ</span><small>{activeCharacter.perk}</small></div>
          </div>

          <div className="character-roster" aria-label="Пятёрка персонажей">
            {characters.map((character, index) => {
              const unlocked = game.lifetime >= character.unlockAt;
              return (
                <button
                  type="button"
                  key={character.id}
                  className={`roster-card${game.selected === index ? ' active' : ''}`}
                  disabled={!unlocked}
                  onClick={() => {
                    characterClicks.current = 0;
                    setGame((current) => ({ ...current, selected: index }));
                  }}
                  aria-label={unlocked ? `Выбрать: ${character.name}, ${character.role}` : `${character.name} откроется при ${character.unlockAt} авторитета`}
                >
                  <img src={character.image} alt="" draggable={false} />
                  <span><strong>{character.name}</strong><small>{character.role}</small></span>
                  {!unlocked && <i className="roster-lock">{formatNumber(character.unlockAt)}</i>}
                </button>
              );
            })}
          </div>

          <footer className="scene-footer"><div><span className="status-dot" /> В СЕТИ С 2007-ГО</div><p>Все персонажи вымышлены. Совпадения — алиби.</p></footer>
        </section>

        <aside className="shop-card">
          <div className="tabs" role="tablist" aria-label="Разделы игры">
            <button type="button" className={tab === 'shop' ? 'active' : ''} onClick={() => setTab('shop')} role="tab" aria-selected={tab === 'shop'}>Мутный ларёк</button>
            <button type="button" className={tab === 'chronicle' ? 'active' : ''} onClick={() => setTab('chronicle')} role="tab" aria-selected={tab === 'chronicle'}>Личное дело</button>
          </div>

          {tab === 'shop' ? (
            <div className="shop-content">
              <div className="shop-heading"><div><p className="eyebrow">Инвестиции без свидетелей</p><h2>Усилить связи</h2></div><span>ЧЕКОВ НЕТ</span></div>
              <p className="active-perk"><strong>{activeCharacter.role}:</strong> {activeCharacter.perk}</p>
              <div className="upgrade-list">
                {upgrades.map((upgrade, index) => {
                  const cost = Math.floor(priceFor(upgrade.baseCost, game.owned[index]) * activeCharacter.priceMultiplier);
                  const effect = upgrade.click ? `+${upgrade.click} за тычок` : `+${upgrade.passive}/сек`;
                  return (
                    <button type="button" className="upgrade-card" key={upgrade.id} disabled={game.authority < cost} onClick={() => buy(index)}>
                      <span className="upgrade-icon" style={{ backgroundPosition: upgrade.position }} aria-hidden="true" />
                      <span className="upgrade-copy">
                        <span className="upgrade-title-row"><strong>{upgrade.name}</strong><b>x{game.owned[index]}</b></span>
                        <small>{upgrade.description}</small><span className="upgrade-effect">{effect}</span>
                      </span>
                      <span className="price">{formatNumber(cost)}<small>АВТ.</small></span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="dossier" role="tabpanel">
              <p className="eyebrow">Совершенно несекретно</p><h2>Личное дело № 404</h2>
              <dl>
                <div><dt>Общий авторитет</dt><dd>{formatNumber(game.lifetime)}</dd></div>
                <div><dt>Куплено связей</dt><dd>{game.owned.reduce((sum, value) => sum + value, 0)}</dd></div>
                <div><dt>Доход без участия</dt><dd>{formatNumber(passive)}/сек</dd></div>
                <div><dt>Дежурный персонаж</dt><dd>{activeCharacter.name}</dd></div>
              </dl>
              <blockquote>«Я ничего не решаю. Я просто знаю человека, который знает человека, который уже уехал».</blockquote>
              <div className="fingerprint" aria-hidden="true">КУМ</div>
            </div>
          )}
        </aside>
      </section>

      <p className="save-status" role="status">{saveUnavailable ? 'Сохранение недоступно: прогресс останется только до закрытия игры.' : 'Прогресс сохраняется на этом устройстве. На другом устройстве будет отдельная игра.'}</p>
      {notice && <div className="event-toast" role="status" aria-live="polite"><span>{notice.label}</span><strong>{notice.title}</strong><p>Авторитет +{formatNumber(notice.bonus)}</p></div>}
    </main>
  );
}
