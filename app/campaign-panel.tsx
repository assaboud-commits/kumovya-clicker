'use client';

import type { Dispatch, Ref } from 'react';
import { campaignChapters, campaignMetricLabels } from './campaign-data';
import { characters, districts, type CharacterId } from './game-data';
import { campaignBonuses, campaignCanClaim, campaignProgress, characterUnlocked, currentCampaignStage, districtUnlocked, type GameAction, type GameState } from './game-engine';
import story from './campaign-content.json';

type Props = {
  game: GameState; ready: boolean; support?: CharacterId;
  setSupport: (id: CharacterId | '') => void; dispatch: Dispatch<GameAction>;
  titleRef: Ref<HTMLHeadingElement>; format: (value: number) => string;
  openPanel: (panel: 'missions' | 'shop' | 'album') => void;
  announce: (message: string) => void;
};

export default function CampaignPanel({ game, ready, support, setSupport, dispatch, titleRef, format, openPanel, announce }: Props) {
  const index = game.campaign.completed.length;
  const chapter = campaignChapters[index];
  const copy = story.chapters[index];
  const stage = currentCampaignStage(game);
  const stageCopy = copy?.stages[game.campaign.stage];
  const hero = characters[game.selected];
  const crew = support ? [hero.id, support] : [hero.id];
  const responsible = game.campaign.active?.crew ?? crew;
  const crewReady = (stage?.crew ?? []).every((id) => crew.includes(id));
  const place = districts.find(({ id }) => id === chapter?.district);
  const inPlace = place?.id === game.district;
  const canVisit = place ? districtUnlocked(game, place.id) : false;
  const bonuses = campaignBonuses(game);

  return <div className="campaign-content">
    <div className="shop-heading"><div><p className="eyebrow">От гаража до семейного апокалипсиса</p><h2 ref={titleRef} tabIndex={-1}>Большая семейка</h2></div><span>{index}/7</span></div>
    <p className="mission-intro">Семь больших глав для коротких заходов в течение недели. Никаких календарных замков: проходи в своём темпе. Поручения помогают проекту, хозяйство растёт, решения остаются с семьёй.</p>
    <div className="fantasy-guests">
      {characters.slice(5).map((character, position) => <button type="button" key={character.id} onClick={() => openPanel('album')}>
        <img src={character.image} alt={character.name + ' — ' + character.role} width={1024} height={1536} />
        <span><small>ПОТУСТОРОННЯЯ РОДНЯ</small><strong>{character.name}</strong><em>{characterUnlocked(game, character.id) ? 'Уже в семье' : 'Присоединится после главы ' + (position + 4)}</em></span>
      </button>)}
    </div>
    <ol className="campaign-track" aria-label="Семь глав кампании">
      {story.chapters.map((item, chapterIndex) => <li key={item.id} className={chapterIndex < index ? 'done' : chapterIndex === index ? 'current' : ''} aria-current={chapterIndex === index ? 'step' : undefined} title={item.title}>
        <b>{chapterIndex < index ? '✓' : chapterIndex + 1}</b><span>{item.title}</span>
      </li>)}
    </ol>
    <p className="campaign-bonuses">Семейные связи: <strong>+{Math.round((bonuses.passive - 1) * 100)}% к доходу</strong> · <strong>+{Math.round((bonuses.click - 1) * 100)}% к тычку</strong></p>

    {!chapter ? <section className="campaign-finale">
      <p className="eyebrow">Все 21 этап позади</p><h3>Конец света стал семейным делом</h3>
      <p>Район жив, преисподняя платит за подсобку, избушка зарегистрирована. Семь глав закрыты, а все постоянные бонусы и родственники остались с тобой.</p>
      <button className="action-button" type="button" onClick={() => openPanel('album')}>СОБРАТЬ СЕМЕЙНЫЕ ИСТОРИИ</button>
    </section> : <>
      <section className="campaign-chapter">
        <img className="chapter-art" src={place!.image} alt="" width={1672} height={941} />
        <div><p className="eyebrow">Глава {index + 1} / 7 · {place!.name}</p><h3>{copy.title}</h3></div>
      </section>
      <p className="chapter-intro">{copy.intro}</p>
      <ol className="stage-track" aria-label="Этапы главы">{copy.stages.map((item, stageIndex) => <li key={item.title} className={stageIndex < game.campaign.stage ? 'done' : stageIndex === game.campaign.stage ? 'current' : ''}><b>{stageIndex < game.campaign.stage ? '✓' : stageIndex + 1}</b><span>{item.title}</span></li>)}</ol>

      {game.campaign.stage === 3 ? <section className="chapter-resolution">
        <p className="eyebrow">Глава готова · реши, как закрепиться</p><h3>Семья выбирает свой путь</h3><p>{copy.ending}</p>
        {chapter.unlock && <p className="new-relative">В семью вступит: <strong>{characters.find(({ id }) => id === chapter.unlock)!.name}</strong></p>}
        <p className="subtle">За главу: +{format(chapter.reward)} авторитета. Один из двух постоянных бонусов прибавится к уже накопленным.</p>
        <div className="event-options">
          {(['quiet', 'bold'] as const).map((route) => <button type="button" key={route} className={route === 'bold' ? 'bold-choice' : ''} disabled={!ready} onClick={() => {
            dispatch({ type: 'resolve-chapter', route });
            announce('Глава завершена: ' + copy.title + '. Получено ' + format(chapter.reward) + ' авторитета и постоянный бонус.');
          }}>
            <span>{route === 'quiet' ? 'ТИХИЕ СВЯЗИ · +5% К ПАССИВНОМУ ДОХОДУ' : 'ГРОМКОЕ ИМЯ · +5% К СИЛЕ ТЫЧКА'}</span>
            <strong>{route === 'quiet' ? copy.quietResult : copy.boldResult}</strong>
          </button>)}
        </div>
      </section> : stage && <section className="campaign-stage">
        <p className="eyebrow">Этап {game.campaign.stage + 1} / 3 · {game.campaign.active ? 'идёт работа' : 'новое большое дело'}</p>
        <h3>{stageCopy.title}</h3><p>{stageCopy.description}</p>
        <div className="crew-picker"><span>Ответственные<br /><strong>{responsible.map((id) => characters.find((item) => item.id === id)!.name).join(' + ')}</strong></span>
          {game.campaign.active ? <span>Состав закреплён<br /><strong>Героя для кликов можно менять</strong></span> : <label>Кто прикроет?<select value={support ?? ''} disabled={!ready} onChange={(event) => setSupport(event.target.value as CharacterId | '')}><option value="">Справлюсь сам</option>{characters.filter((item) => item.id !== hero.id && characterUnlocked(game, item.id)).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}
        </div>
        {!!stage.crew?.length && <p className={'crew-requirement' + ((game.campaign.active ? stage.crew.every((id) => responsible.includes(id)) : crewReady) ? ' satisfied' : '')}>Нужны в команде: <strong>{stage.crew.map((id) => characters.find((item) => item.id === id)!.name).join(' + ')}</strong>. Выбери ведущего в ленте героев, второго — напарником.</p>}
        <p className="subtle">Все счётчики этапа начинаются после нажатия «Начать». Поручения из соседнего раздела можно выполнять одновременно.</p>
        <div className="campaign-goals">{campaignProgress(game).map(({ metric, target, value }) => <div key={metric} className={value >= target ? 'done' : ''}>
          <div><span>{campaignMetricLabels[metric]}</span><strong>{format(value)} / {format(target)}</strong></div><progress value={value} max={target} aria-label={campaignMetricLabels[metric]} />
        </div>)}</div>
        {(stage.maxHeat !== undefined || stage.minHeat !== undefined) && <p className="campaign-heat">Для сдачи: <strong>{stage.maxHeat !== undefined ? 'палево не выше ' + stage.maxHeat : 'палево от ' + stage.minHeat}</strong>. Сейчас {stage.maxHeat !== undefined ? Math.ceil(game.heat) : Math.floor(game.heat)}. Меняй палево решениями кипишей.</p>}
        <div className="campaign-investment"><span>Вклад в район при сдаче<strong>{format(stage.investment)} авт.</strong></span><span>Награда этапа<strong>+{format(stage.reward)} авт.</strong></span></div>
        {stage.investment > game.authority && <p className="subtle">Для вклада не хватает {format(stage.investment - game.authority)} авторитета. Деньги спишутся только при сдаче, не сейчас.</p>}
        {!inPlace && <div className="campaign-location-note"><p>{canVisit ? 'Для старта и сдачи нужен район: ' + place!.name + '.' : 'Сначала открой район «' + place!.name + '»: ' + format(place!.unlockAt) + ' общего авторитета и ' + place!.requiredMissions + ' разных поручений.'}</p>
          {canVisit ? <button type="button" className="action-button" disabled={!ready || !!game.activeMission} onClick={() => dispatch({ type: 'district', id: place!.id })}>ПЕРЕЕХАТЬ В РАЙОН</button> : <button type="button" className="text-button" onClick={() => openPanel('missions')}>К местным поручениям →</button>}
          {game.activeMission && <p className="subtle">Сначала заверши или отмени текущее поручение — оно удерживает команду в районе.</p>}
        </div>}
        <div className="campaign-actions">{game.campaign.active ? <>
          <button type="button" className="action-button" disabled={!ready || !campaignCanClaim(game)} onClick={() => {
            dispatch({ type: 'claim-campaign-stage' });
            announce('Этап закреплён: ' + stageCopy.title + '. Вклад в район: ' + format(stage.investment) + ' авторитета.');
          }}>ВЛОЖИТЬ {format(stage.investment)} И ЗАКРЕПИТЬ ЭТАП</button>
          <button type="button" className="text-button" onClick={() => dispatch({ type: 'cancel-campaign-stage' })}>Отменить этап и начать его счётчики заново</button>
        </> : <button type="button" className="action-button" disabled={!ready || !inPlace || !canVisit || !crewReady} onClick={() => dispatch({ type: 'start-campaign-stage', support })}>НАЧАТЬ ЭТАП</button>}</div>
        <div className="campaign-shortcuts"><button type="button" className="text-button" onClick={() => openPanel('shop')}>Развить хозяйство →</button><button type="button" className="text-button" onClick={() => openPanel('missions')}>Взять поручение →</button></div>
      </section>}
    </>}
  </div>;
}
