'use client';

import { type MouseEvent, useEffect, useReducer, useRef, useState } from 'react';
import { initializeTelegram } from './telegram';
import { characters, characterChapterGates, districts, missions, upgrades, ranks, metricLabels, SAVE_KEY, STORY_REWARD, type CharacterId } from './game-data';
import { createGameState, gameReducer, getPowers, nextClickReward, upgradePrice, upgradeMilestone, missionTarget, missionProgress, missionQuote, districtUnlocked, characterUnlocked, completedMissions, eventRewards, readGameSave, campaignProgress } from './game-engine';
import CampaignPanel from './campaign-panel';
import { campaignMetricLabels } from './campaign-data';
import campaignContent from './campaign-content.json';
import content from './district-content.json';

type FloatHit = { id: number; x: number; y: number; value: number };
function formatNumber(value: number) {
  if (value < 1000) return Math.floor(value).toLocaleString('ru-RU');
  const units = [[1_000_000_000, 'млрд'], [1_000_000, 'млн'], [1000, 'тыс.']] as const;
  const unit = units.find(([size]) => value >= size)!;
  return (value / unit[0]).toLocaleString('ru-RU', { maximumFractionDigits: value >= unit[0] * 100 ? 0 : 1 }) + ' ' + unit[1];
}

export default function Home() {
  const [game, dispatch] = useReducer(gameReducer, undefined, createGameState);
  const [ready, setReady] = useState(false);
  const [saveUnavailable, setSaveUnavailable] = useState(false);
  const [migrated, setMigrated] = useState(false);
  const [loadWarning, setLoadWarning] = useState(false);
  const [tab, setTab] = useState<'campaign' | 'missions' | 'shop' | 'album'>('campaign');
  const [support, setSupport] = useState<CharacterId | ''>('');
  const [floats, setFloats] = useState<FloatHit[]>([]);
  const [pressed, setPressed] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const audioRef = useRef<AudioContext | null>(null);
  const hitId = useRef(0);
  const panelRef = useRef<HTMLElement | null>(null);
  const panelTitleRef = useRef<HTMLHeadingElement | null>(null);
  const eventRef = useRef<HTMLElement | null>(null);
  const eventTitleRef = useRef<HTMLHeadingElement | null>(null);
  const dealTitleRef = useRef<HTMLHeadingElement | null>(null);

  const activeCharacter = characters[game.selected] ?? characters[0];
  const location = districts.find(({ id }) => id === game.district)!;
  const powers = getPowers(game);
  const completed = completedMissions(game);
  const activeMission = missions.find(({ id }) => id === game.activeMission?.id);
  const progress = missionProgress(game);
  const activeTarget = game.activeMission?.target ?? 0;
  const chapterIndex = game.campaign.completed.length;
  const bigGoals = campaignProgress(game);
  const pendingEvent = content.events.find(({ id }) => id === game.pendingEvent?.id);
  const payouts = eventRewards(game);
  const partner = support && support !== activeCharacter.id && characterUnlocked(game, support) ? support : undefined;
  const crew: CharacterId[] = partner ? [activeCharacter.id, partner] : [activeCharacter.id];
  const rankIndex = ranks.reduce((result, [threshold], index) => game.lifetime >= threshold ? index : result, 0);
  const rank = ranks[rankIndex];
  const nextRank = ranks[Math.min(rankIndex + 1, ranks.length - 1)];
  const rankProgress = rankIndex === ranks.length - 1 ? 100 : ((game.lifetime - rank[0]) / (nextRank[0] - rank[0])) * 100;

  useEffect(() => {
    const loaded = readGameSave((key) => localStorage.getItem(key));
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      dispatch({ type: 'load', state: loaded.state });
      setMigrated(loaded.migrated);
      setLoadWarning(loaded.unreadable);
      setReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready || loadWarning) return;
    let failed = false;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(game));
    } catch { failed = true; }
    let active = true;
    queueMicrotask(() => { if (active) setSaveUnavailable(failed); });
    return () => { active = false; };
  }, [game, ready, loadWarning]);

  useEffect(() => {
    if (!ready) return;
    initializeTelegram(window.Telegram?.WebApp);
    const timer = window.setInterval(() => dispatch({ type: 'tick', seconds: 1 }), 1000);
    return () => window.clearInterval(timer);
  }, [ready]);

  function openPanel(next: typeof tab) {
    setTab(next);
    panelRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    window.setTimeout(() => panelTitleRef.current?.focus({ preventScroll: true }), 0);
  }
  function jumpToEvent() {
    eventRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    eventTitleRef.current?.focus({ preventScroll: true });
  }
  function announceCampaign(message: string) {
    setAnnouncement(message);
    window.setTimeout(() => panelTitleRef.current?.focus({ preventScroll: true }), 0);
  }
  function resolveEvent(index: 0 | 1) {
    if (!pendingEvent) return;
    const choice = pendingEvent.choices[index];
    setAnnouncement(`Кипиш решён. ${choice.result} Получено ${formatNumber(payouts[index])} авторитета.`);
    dispatch({ type: 'resolve-event', choice: index });
    window.setTimeout(() => dealTitleRef.current?.focus({ preventScroll: true }), 0);
  }
  function playClick() {
    if (!game.sound) return;
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = audioRef.current ?? new AudioContextClass();
      audioRef.current = context;
      if (context.state === 'suspended') void context.resume().catch(() => {});
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(118, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(72, context.currentTime + .055);
      gain.gain.setValueAtTime(.035, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .06);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + .065);
    } catch { /* Audio is optional. */ }
  }
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (!ready) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const id = ++hitId.current;
    const value = nextClickReward(game);
    setFloats((items) => [...items.slice(-7), { id, value, x: event.detail === 0 ? rect.width / 2 : event.clientX - rect.left, y: event.detail === 0 ? rect.height / 2 : event.clientY - rect.top }]);
    window.setTimeout(() => setFloats((items) => items.filter((item) => item.id !== id)), 800);
    setPressed(true);
    window.setTimeout(() => setPressed(false), 95);
    playClick();
    dispatch({ type: 'click', roll: Math.random() });
  }

  return (
    <main className="game-shell expansion-shell">
      <div className="noise" aria-hidden="true" />
      <header className="topbar">
        <div className="brand-block">
          <p className="eyebrow">Большая семейка · семь глав и двое с того света</p>
          <h1>КУМОВЬЯ</h1>
          <p className="motto">Семья — это святое. Особенно когда весь район записан на неё.</p>
        </div>
        <div className="stats-strip" aria-label="Игровая статистика">
          <div className="stat"><span>Авторитет</span><strong>{formatNumber(game.authority)}</strong></div>
          <div className="stat"><span>За тычок</span><strong>+{formatNumber(powers.click)}</strong></div>
          <div className="stat"><span>Само капает</span><strong>{formatNumber(powers.passive)}/сек</strong></div>
          <button className="sound-button" type="button" disabled={!ready} onClick={() => dispatch({ type: 'sound' })} aria-label={game.sound ? 'Выключить звук' : 'Включить звук'}>{game.sound ? 'ЗВУК: ДА' : 'ЗВУК: НЕТ'}</button>
        </div>
      </header>

      <div className="ticker" aria-label="Срочные новости"><span>СРОЧНО</span><p>Район выставлен на семейное обсуждение. Возражения принимаются через тётю Зину.</p></div>

      <section className="district-map" aria-label="Три района">
        <div className="chapter-heading"><div><p className="eyebrow">От гаража до главного кабинета</p><h2>Территория своих</h2></div><span>{chapterIndex} / 7 больших глав<br />{completed} / 10 поручений</span></div>
        <div className="district-cards">
          {districts.map((district) => {
            const unlocked = districtUnlocked(game, district.id);
            const busy = !!game.activeMission && game.district !== district.id;
            return (
              <button type="button" key={district.id} className={'district-card' + (game.district === district.id ? ' selected' : '') + (!unlocked ? ' locked' : '')} disabled={!ready || !unlocked || busy} aria-pressed={game.district === district.id} aria-label={unlocked ? 'Перейти: ' + district.name + (busy ? '. Сначала заверши или отмени дело.' : '') : district.name + ': нужно ' + district.unlockAt + ' общего авторитета и ' + district.requiredMissions + ' разных дела'} onClick={() => dispatch({ type: 'district', id: district.id })}>
                <img src={district.image} alt="" width={1672} height={941} draggable={false} />
                <span className="district-number">{district.number}</span>
                <span className="district-card-copy"><strong>{district.name}</strong><small>{unlocked ? district.perk : formatNumber(district.unlockAt) + ' авторитета · ' + district.requiredMissions + ' разных дела'}</small></span>
                <span className="district-tag">{game.district === district.id ? 'МЫ ЗДЕСЬ' : unlocked ? (busy ? 'ИДЁТ ДЕЛО' : 'ОТКРЫТО') : 'НЕ НАШ РАЙОН'}</span>
              </button>
            );
          })}
        </div>
        <p className="district-description"><strong>{location.name}.</strong> {location.description} {game.activeMission && <span>Переезд доступен после завершения или отмены дела.</span>}</p>
      </section>

      <button type="button" className="campaign-strip" onClick={() => openPanel('campaign')}><span><small>БОЛЬШАЯ СЕМЕЙКА · ДЛИННАЯ КАМПАНИЯ</small><strong>{chapterIndex === 7 ? 'Район принят на семейный баланс' : 'Глава ' + (chapterIndex + 1) + ': ' + campaignContent.chapters[chapterIndex].title}</strong></span><b>{chapterIndex === 7 ? 'К ФИНАЛУ' : 'К БОЛЬШОМУ ДЕЛУ →'}</b></button>
      {migrated && <p className="migration-note" role="status">Семейный архив принят: твой авторитет, покупки и открытые персонажи перенесены без сброса.</p>}
      {loadWarning && <p className="migration-note warning" role="status">Сохранение не удалось прочитать. Старые данные не изменены; до восстановления архива новая игра работает без сохранения.</p>}
      <p className="sr-only" aria-live="polite">{announcement}</p>
      {pendingEvent && <button type="button" className="kipish-jump" onClick={jumpToEvent}>НА РАЙОНЕ КИПИШ — {pendingEvent.title} <span>РЕШИТЬ ↓</span></button>}

      <section className="game-grid">
        <section className="scene-card" aria-label={activeCharacter.name}>
          <div className="rank-panel">
            <div><span>Текущий статус</span><strong>{rank[1]}</strong></div>
            <div className="rank-meter" role="progressbar" aria-label="Прогресс статуса" aria-valuenow={Math.floor(rankProgress)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: Math.min(100, rankProgress) + '%' }} /></div>
            <small>{rankIndex === ranks.length - 1 ? 'Выше только семейный чат' : 'До следующего: ' + formatNumber(Math.max(0, nextRank[0] - game.lifetime))}</small>
          </div>

          <div className="character-stage">
            <div className="character-title"><strong>{activeCharacter.name}</strong><span>{activeCharacter.role}</span></div>
            <div className="bad-stamp" aria-hidden="true">СВОЙ<br />ЧЕЛОВЕК</div>
            <button type="button" className={'character-button' + (pressed ? ' is-pressed' : '')} disabled={!ready} onClick={handleClick} aria-label={'Нажать на персонажа ' + activeCharacter.name + ' и получить ' + powers.click + ' авторитета'}>
              <img src={activeCharacter.image} alt={activeCharacter.name + ' — ' + activeCharacter.role} draggable={false} />
              {floats.map((item) => <span className="float-hit" key={item.id} style={{ left: item.x, top: item.y }}>+{formatNumber(item.value)}</span>)}
            </button>
            <div className="click-plate"><span>ДАВИ НА СВЯЗИ</span><small>{activeCharacter.perk}</small></div>
          </div>

          <div className="character-roster" aria-label="Семеро своих">
            {characters.map((character, index) => {
              const unlocked = characterUnlocked(game, character.id);
              const gate = characterChapterGates[character.id];
              return <button type="button" key={character.id} className={'roster-card' + (game.selected === index ? ' active' : '')} disabled={!ready || !unlocked} onClick={() => dispatch({ type: 'select', index })} aria-pressed={game.selected === index} aria-label={unlocked ? 'Выбрать: ' + character.name + ', ' + character.role : character.name + (gate ? ' присоединится после главы ' + gate : ' откроется при ' + character.unlockAt + ' общего авторитета')}>
                <img src={character.image} alt="" draggable={false} />
                <span><strong>{character.name}</strong><small>{character.role}</small></span>
                {!unlocked && <i className="roster-lock">{gate ? 'ГЛ. ' + gate : formatNumber(character.unlockAt)}</i>}
              </button>;
            })}
          </div>

          {game.campaign.active && <section className="campaign-compact" aria-label="Активный этап кампании"><p className="eyebrow">Большое дело идёт параллельно</p><h3>{campaignContent.chapters[chapterIndex].stages[game.campaign.stage].title}</h3>{bigGoals.map(({ metric, value, target }) => <span key={metric}>{campaignMetricLabels[metric]}: <b>{formatNumber(value)} / {formatNumber(target)}</b></span>)}<button type="button" className="text-button" onClick={() => openPanel('campaign')}>Условия и сдача этапа →</button></section>}
          <div className="active-deal">
            {activeMission && game.activeMission ? <>
              <p className="eyebrow">Дело в работе · награда зафиксирована</p>
              <h3 ref={dealTitleRef} tabIndex={-1}>{activeMission.title}</h3>
              <p className="crew-line">{game.activeMission.crew.map((id) => characters.find((character) => character.id === id)!.name).join(' + ')}</p>
              <div className="mission-progress-label"><span>{metricLabels[activeMission.metric]}</span><b>{formatNumber(progress)} / {formatNumber(activeTarget)}</b></div>
              <progress value={progress} max={activeTarget} aria-label={'Прогресс дела ' + activeMission.title} />
              <div className="deal-actions"><button className="action-button" type="button" disabled={!ready || progress < activeTarget} onClick={() => dispatch({ type: 'claim-mission' })}>{progress >= activeTarget ? 'ЗАБРАТЬ +' + formatNumber(game.activeMission.reward) : 'В РАБОТЕ · +' + formatNumber(game.activeMission.reward)}</button><button className="text-button" type="button" onClick={() => dispatch({ type: 'cancel-mission' })}>Отменить без штрафа</button></div>
              {activeMission.metric === 'upgrades' && progress < activeTarget && <button className="text-button" type="button" onClick={() => openPanel('shop')}>Купить улучшения в ларьке →</button>}
              {activeMission.metric === 'passive' && powers.passive === 0 && <button className="text-button" type="button" onClick={() => openPanel('shop')}>Для дохода нужен мангал или телефон →</button>}
              {activeMission.metric === 'choices' && !pendingEvent && <p className="subtle">Нажимай на героя — кипиш появится не позднее 36 нажатий.</p>}
            </> : <>
              <p className="eyebrow">Поручения между большими делами</p><h3 ref={dealTitleRef} tabIndex={-1}>{completed === 10 ? 'На районе снова есть работа' : completed ? 'Пора за следующее мутное дело' : 'Возьми первое мутное дело'}</h3>
              <p>Поручения помогают большой кампании. Два совместных дела или этапа с героем откроют его личную историю.</p>
              <button className="action-button" type="button" onClick={() => openPanel('missions')}>{completed === 10 ? 'ПЕРЕИГРАТЬ ДЕЛА' : 'ВЫБРАТЬ ДЕЛО →'}</button>
            </>}
          </div>

          <section className={'heat-panel' + (game.heat >= 70 ? ' hot' : '')} aria-label="Уровень палева">
            <div><strong>ПАЛЕВО</strong><span>{Math.ceil(game.heat)} / 100 · {game.heat >= 70 ? 'На карандаше' : game.heat >= 35 ? 'Уже шепчутся' : 'Пока свои'}</span></div>
            <progress value={game.heat} max={100} aria-label="Палево" />
            <p>С 70 палева новые поручения дают на 20% меньше. Тихие решения снимают 12; само остывает на {activeCharacter.id === 'yaga' ? '5' : '1'} за 10 секунд открытой игры.{activeCharacter.id === 'azazel' && ' Азазель при палеве от 70 получает ещё ×1,5 к тычку.'}</p>
          </section>

          {pendingEvent && <section className="choice-event" ref={eventRef} aria-labelledby="event-title">
            <p className="eyebrow">Кипиш · выбери, как разрулить</p><h3 id="event-title" ref={eventTitleRef} tabIndex={-1}>{pendingEvent.title}</h3><p>{pendingEvent.setup}</p>
            <div className="event-options">{pendingEvent.choices.map((choice, index) => <button type="button" key={choice.kind} className={index === 1 ? 'bold-choice' : ''} onClick={() => resolveEvent(index as 0 | 1)} disabled={!ready}>
              <span>{index === 0 ? 'ТИХО РЕШИТЬ' : 'УСТРОИТЬ ПОКАЗУХУ'}</span><strong>{choice.label}</strong><small>+{formatNumber(payouts[index])} авторитета · {index === 0 ? '−12' : '+18'} палева</small>
            </button>)}</div>
          </section>}

          <footer className="scene-footer"><div><span className="status-dot" /> СВОИ С 2007-ГО</div><p>Все персонажи вымышлены. Совпадения — алиби.</p></footer>
        </section>

        <aside className="shop-card district-workspace" ref={panelRef}>
          <nav className="tabs expansion-tabs" aria-label="Разделы игры">
            <button type="button" className={tab === 'campaign' ? 'active' : ''} aria-pressed={tab === 'campaign'} onClick={() => setTab('campaign')}>Большая семейка</button>
            <button type="button" className={tab === 'missions' ? 'active' : ''} aria-pressed={tab === 'missions'} onClick={() => setTab('missions')}>Мутные дела</button>
            <button type="button" className={tab === 'shop' ? 'active' : ''} aria-pressed={tab === 'shop'} onClick={() => setTab('shop')}>Мутный ларёк</button>
            <button type="button" className={tab === 'album' ? 'active' : ''} aria-pressed={tab === 'album'} onClick={() => setTab('album')}>Семейный альбом</button>
          </nav>

          {tab === 'campaign' && <CampaignPanel game={game} ready={ready} support={partner} setSupport={setSupport} dispatch={dispatch} titleRef={panelTitleRef} format={formatNumber} openPanel={openPanel} announce={announceCampaign} />}
          {tab === 'missions' && <div className="missions-content">
            <div className="shop-heading"><div><p className="eyebrow">Дела без лишних свидетелей</p><h2 ref={panelTitleRef} tabIndex={-1}>{location.name}</h2></div><span>{completed}/10</span></div>
            <p className="mission-intro">Один герой ведёт дело, второй может прикрыть. Специалист даёт +25% к награде, напарник — ещё +10%.</p>
            <div className="crew-picker"><span>Ведёт дело<br /><strong>{game.activeMission ? characters.find(({ id }) => id === game.activeMission!.crew[0])!.name : activeCharacter.name}</strong></span>{game.activeMission ? <span>Прикрывает<br /><strong>{characters.find(({ id }) => id === game.activeMission!.crew[1])?.name ?? 'Работает в одиночку'}</strong></span> : <label>Кто прикроет?<select value={partner ?? ''} onChange={(event) => setSupport(event.target.value as CharacterId | '')} disabled={!ready}><option value="">Справлюсь сам</option>{characters.filter((character) => character.id !== activeCharacter.id && characterUnlocked(game, character.id)).map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}</select></label>}</div>
            {game.activeMission && <p className="subtle">Команда текущего дела уже закреплена. Можно переключать героя для кликов — состав дела не изменится.</p>}
            {game.heat >= 70 && <p className="mission-warning">Слишком шумно: награда новых дел сейчас снижена на 20%.</p>}
            <div className="mission-list">{missions.filter(({ district }) => district === game.district).map((mission, index) => {
              const runs = game.missionRuns[mission.id] ?? 0;
              const specialist = characters.find(({ id }) => id === mission.specialist)!;
              const inProgress = game.activeMission?.id === mission.id;
              return <article className={'mission-card' + (runs > 0 ? ' completed' : '') + (inProgress ? ' in-progress' : '')} key={mission.id}>
                <div className="mission-topline"><span>ДЕЛО {String(index + 1).padStart(2, '0')}</span><b>{inProgress ? 'В РАБОТЕ' : runs > 0 ? 'ЗАКРЫТО · ×' + runs : 'ЕСТЬ ТЕМА'}</b></div>
                <h3>{mission.title}</h3><p>{mission.description}</p>
                <div className="mission-goal">{metricLabels[mission.metric]}: <strong>{formatNumber(inProgress ? activeTarget : missionTarget(game, mission))}</strong>{runs > 0 && <small>{mission.metric === 'upgrades' ? ' · нужны новые покупки' : ' · цель повтора растёт вместе с хозяйством'}</small>}</div>
                <div className="specialist"><img src={specialist.image} alt="" /><span>В теме: <strong>{specialist.name}</strong>{crew.includes(mission.specialist) && ' · бонус команды'}</span></div>
                <div className="mission-bottom"><div><strong>+{formatNumber(inProgress ? game.activeMission!.reward : missionQuote(game, mission, crew))}</strong><small>{runs > 0 ? 'Повтор: 35% базовой награды' : 'авторитета за дело'}</small></div><button className="action-button" type="button" disabled={!ready || !!game.activeMission} onClick={() => dispatch({ type: 'start-mission', id: mission.id, support: partner })}>{inProgress ? 'В РАБОТЕ' : runs > 0 ? 'ПОВТОРИТЬ' : 'ВЗЯТЬ ДЕЛО'}</button></div>
              </article>;
            })}</div>
            {completed === 10 && <div className="chapter-complete"><strong>СВОЙ В КАЖДОМ РАЙОНЕ</strong><p>Все десять поручений знакомы. Главная история продолжается в «Большой семейке» — семь глав и потусторонняя родня.</p><button className="text-button" type="button" onClick={() => openPanel('campaign')}>Продолжить кампанию →</button></div>}
          </div>}

          {tab === 'shop' && <div className="shop-content">
            <div className="shop-heading"><div><p className="eyebrow">Инвестиции без свидетелей</p><h2 ref={panelTitleRef} tabIndex={-1}>Усилить связи</h2></div><span>ЧЕКОВ НЕТ</span></div>
            <p className="active-perk"><strong>{activeCharacter.role}:</strong> {activeCharacter.perk}</p>
            <p className="subtle">{location.name}: {location.perk}. Пассивный доход начисляется, пока игра открыта.</p>
            <p className="upgrade-milestone-note">Каждые 5 покупок одного улучшения усиливают всю его сеть: ×1,5 на пятой, ×2 на десятой, ×2,5 на пятнадцатой. Планируй вложения между этапами.</p>
            <div className="upgrade-list">{upgrades.map((upgrade, index) => {
              const cost = upgradePrice(game, index);
              return <button type="button" className="upgrade-card" key={upgrade.id} disabled={!ready || game.authority < cost} onClick={() => dispatch({ type: 'buy', index })}>
                <span className="upgrade-icon" style={{ backgroundPosition: upgrade.position }} aria-hidden="true" />
                <span className="upgrade-copy"><span className="upgrade-title-row"><strong>{upgrade.name}</strong><b>×{game.owned[index]}</b></span><small>{upgrade.description}</small><span className="upgrade-effect">{upgrade.click ? '+' + upgrade.click + ' за тычок' : '+' + upgrade.passive + '/сек'} · сеть ×{upgradeMilestone(game.owned[index]).toLocaleString('ru-RU')}</span><span className="milestone-next">Следующий рубеж: {(Math.floor(game.owned[index] / 5) + 1) * 5} покупок</span></span>
                <span className="price">{formatNumber(cost)}<small>АВТ.</small></span>
              </button>;
            })}</div>
          </div>}

          {tab === 'album' && <div className="album-content">
            <div className="shop-heading"><div><p className="eyebrow">За каждым лицом — дело</p><h2 ref={panelTitleRef} tabIndex={-1}>Свои люди</h2></div><span>{game.storyClaims.length}/{characters.length}</span></div>
            <p className="mission-intro">Закрой два поручения или этапа с героем в команде — узнаешь его историю и получишь +{STORY_REWARD} авторитета. Азазель приходит после четвёртой главы, Яга — после пятой.</p>
            <div className="story-list">{[...content.stories, ...campaignContent.stories].map((story) => {
              const character = characters.find(({ id }) => id === story.characterId)!;
              const bond = game.bonds[character.id];
              const unlocked = bond >= 2;
              const claimed = game.storyClaims.includes(character.id);
              return <article className={'story-card' + (unlocked ? ' revealed' : '')} key={story.id}>
                <header><img src={character.image} alt={character.name} /><div><span>{character.name}</span><h3>{story.title}</h3><small>{Math.min(2, bond)}/2 совместных дела</small></div></header>
                <p>{story.teaser}</p>
                <details><summary>{unlocked ? 'ОТКРЫТЬ ИСТОРИЮ' : 'ЗАГЛЯНУТЬ В ПРОШЛОЕ'}</summary><p>{story.before}</p>{unlocked ? <><p>{story.after}</p><blockquote>«{story.quote}»</blockquote></> : <p className="story-locked">Остальное — только для своих. Ещё {Math.max(0, 2 - bond)} совместных дела.</p>}</details>
                <button className="action-button" type="button" disabled={!ready || !unlocked || claimed} onClick={() => dispatch({ type: 'claim-story', character: character.id })}>{claimed ? 'В СЕМЕЙНОМ АРХИВЕ' : unlocked ? 'ЗАБРАТЬ +' + STORY_REWARD : 'СНАЧАЛА ДВА ДЕЛА'}</button>
              </article>;
            })}</div>
            <div className="album-stats"><span>За всё время <strong>{formatNumber(game.lifetime)} авт.</strong></span><span>Кипишей разрулено <strong>{game.stats.choices}</strong></span><span>Разных дел <strong>{completed}/10</strong></span></div>
          </div>}

          <section className="district-journal" aria-label="Районная сводка"><p className="eyebrow">Районная сводка</p>
            {game.journal.length ? game.journal.slice(0, 3).map((entry) => <article key={entry.id}><strong>{entry.title}</strong><p>{entry.text}</p>{entry.amount > 0 && <small>+{formatNumber(entry.amount)} авторитета</small>}</article>) : <p>Пока тихо. Возьми дело или нажми на героя — району есть что рассказать.</p>}
          </section>
        </aside>
      </section>

      <p className="save-status" role="status">Большая семейка · версия 3. {saveUnavailable || loadWarning ? 'Сохранение недоступно: новый прогресс останется только до закрытия игры.' : 'Главы, этапы, незавершённые поручения и выборы сохраняются на этом устройстве. Между устройствами пока не синхронизируются.'}</p>
    </main>
  );
}
